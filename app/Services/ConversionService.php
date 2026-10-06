<?php

namespace App\Services;

use App\Models\BimModel;
use App\Models\ConversionJob;
use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Process\Process;

class ConversionService
{
    protected ProjectRepository $projectRepository;

    public function __construct(ProjectRepository $projectRepository)
    {
        $this->projectRepository = $projectRepository;
    }

    /**
     * Accepts IFC upload, creates/validates project, and prepares conversion job.
     */
    public function createJob(UploadedFile $file, ?string $projectId, User $user): array
    {
        $originalName = $file->getClientOriginalName();
        $baseName = pathinfo($originalName, PATHINFO_FILENAME);

        if (! str_ends_with(strtolower($originalName), '.ifc')) {
            throw new \InvalidArgumentException('Solo se admiten archivos con formato IFC (.ifc).');
        }

        // Determine or create target project
        $targetProject = null;
        if (! empty($projectId)) {
            if (! $user->isAdmin() && ! $user->hasAccessToProject($projectId)) {
                throw new AccessDeniedHttpException('Acceso denegado al proyecto solicitado.');
            }
            $targetProject = $this->projectRepository->findById($projectId, false);
            if (! $targetProject) {
                throw new ModelNotFoundException("Proyecto con ID {$projectId} no encontrado.");
            }
        } else {
            // Auto-create project named after the model
            $targetProject = $this->projectRepository->create([
                'name' => $baseName,
                'description' => "Proyecto creado automáticamente para {$originalName}",
            ]);
            // If normal user created it, associate them
            if (! $user->isAdmin()) {
                $user->projects()->attach($targetProject->id, ['assigned_at' => now()->timestamp]);
            }
        }

        $jobId = (string) Str::uuid();

        // Save incoming IFC to temporary conversion storage
        $tempDir = storage_path("app/temp/conversions/{$jobId}");
        if (! file_exists($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $inputIfcPath = "{$tempDir}/input.ifc";
        $file->move($tempDir, 'input.ifc');

        // Persist ConversionJob in database
        $job = ConversionJob::create([
            'id' => $jobId,
            'project_id' => $targetProject->id,
            'status' => 'queued',
            'progress' => 0,
        ]);

        return [
            'jobId' => $job->id,
            'targetProjectId' => $targetProject->id,
            'progressUrl' => "/api/jobs/{$job->id}/progress",
            'fileName' => $originalName,
        ];
    }

    /**
     * Executes the Node.js converter script and streams real-time SSE progress events to the browser.
     */
    public function streamProgress(string $jobId, User $user): StreamedResponse
    {
        $job = ConversionJob::with('project')->find($jobId);

        if (! $job) {
            throw new ModelNotFoundException("Trabajo de conversión {$jobId} no encontrado.");
        }

        if (! $user->hasAccessToProject($job->project_id)) {
            throw new AccessDeniedHttpException('Acceso denegado a este trabajo de conversión.');
        }

        return response()->stream(function () use ($job) {
            // Disable output buffering for live SSE streaming
            if (ob_get_level() > 0) {
                ob_end_flush();
            }

            $sendEvent = function (string $event, array $data) {
                echo "event: {$event}\n";
                echo 'data: ' . json_encode($data) . "\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            $startTime = microtime(true);
            $sendEvent('progress', [
                'percent' => 5,
                'stage' => 'Iniciando subproceso de conversión en Node.js...',
            ]);

            $tempDir = storage_path("app/temp/conversions/{$job->id}");
            $inputIfc = "{$tempDir}/input.ifc";
            $outputFrag = "{$tempDir}/output.frag";

            if (! file_exists($inputIfc)) {
                $job->update(['status' => 'failed', 'error_message' => 'Archivo IFC de entrada no encontrado en disco.']);
                $sendEvent('error', ['error' => 'Archivo IFC de entrada no encontrado en disco.']);
                return;
            }

            $job->update(['status' => 'processing', 'progress' => 10]);

            $scriptPath = base_path('scripts/convert-ifc.js');
            $nodePath = 'node';

            $process = new Process([
                $nodePath,
                '--max-old-space-size=16384',
                $scriptPath,
                $inputIfc,
                $outputFrag,
            ]);
            $process->setTimeout(3600); // Allow up to 1 hour for large files

            $currentPercent = 10;
            $process->run(function ($type, $buffer) use (&$currentPercent, $sendEvent) {
                // Parse progress percentages if emitted in stdout
                if (preg_match('/(\d{1,3})%/', $buffer, $matches)) {
                    $pct = (int) $matches[1];
                    if ($pct > $currentPercent && $pct < 95) {
                        $currentPercent = $pct;
                        $sendEvent('progress', [
                            'percent' => $currentPercent,
                            'stage' => 'Convirtiendo geometría IFC a fragmentos (.frag)...',
                        ]);
                    }
                }
            });

            if (! $process->isSuccessful()) {
                $errorMsg = $process->getErrorOutput() ?: $process->getOutput() ?: 'Fallo en la ejecución del convertidor Node.js';
                $job->update(['status' => 'failed', 'error_message' => $errorMsg]);
                $sendEvent('error', ['error' => $errorMsg]);
                return;
            }

            // Conversion completed successfully. Collect generated .frag files
            $fragFiles = glob("{$tempDir}/*.frag");
            if (empty($fragFiles)) {
                $fragFiles = file_exists($outputFrag) ? [$outputFrag] : [];
            }

            if (empty($fragFiles)) {
                $job->update(['status' => 'failed', 'error_message' => 'El conversor no generó archivos .frag válidos.']);
                $sendEvent('error', ['error' => 'El conversor no generó archivos .frag válidos.']);
                return;
            }

            $sendEvent('progress', [
                'percent' => 90,
                'stage' => 'Registrando modelos fragmentados en catálogo y base de datos...',
            ]);

            $projectId = $job->project_id;
            $parts = [];
            $downloadUrls = [];
            $totalBytes = 0;

            foreach ($fragFiles as $fragAbsPath) {
                $partName = basename($fragAbsPath);
                $fileSize = filesize($fragAbsPath);
                $totalBytes += $fileSize;

                // Move file to project storage
                $relStoragePath = "{$projectId}/{$partName}";
                Storage::disk('models')->put($relStoragePath, file_get_contents($fragAbsPath));

                // Register BimModel record in database
                $model = BimModel::create([
                    'project_id' => $projectId,
                    'name' => $partName,
                    'storage_path' => $relStoragePath,
                    'size_bytes' => $fileSize,
                    'status' => 'ready',
                ]);

                $parts[] = $partName;
                $downloadUrls[] = "/api/models/{$model->id}/download";
            }

            // Clean temporary files
            try {
                array_map('unlink', glob("{$tempDir}/*.*"));
                rmdir($tempDir);
            } catch (\Throwable $e) {
                // non-fatal cleanup
            }

            $durationSec = number_format(microtime(true) - $startTime, 2);
            $totalSizeMB = number_format($totalBytes / (1024 * 1024), 2);

            $job->update([
                'status' => 'completed',
                'progress' => 100,
                'parts_json' => $parts,
            ]);

            $sendEvent('complete', [
                'parts' => $parts,
                'downloadUrls' => $downloadUrls,
                'totalSizeMB' => $totalSizeMB,
                'durationSec' => $durationSec,
            ]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Download fragment part produced by a job.
     */
    public function downloadJobPart(string $jobId, string $part, User $user): BinaryFileResponse|StreamedResponse
    {
        $job = ConversionJob::findOrFail($jobId);

        if (! $user->hasAccessToProject($job->project_id)) {
            throw new AccessDeniedHttpException('Acceso denegado a las partes de este proyecto.');
        }

        $relPath = "{$job->project_id}/{$part}";

        if (! Storage::disk('models')->exists($relPath)) {
            // Also check if part was given by numeric index (1-based)
            $parts = $job->parts_json ?: [];
            $idx = is_numeric($part) ? ((int) $part) - 1 : -1;
            if (isset($parts[$idx])) {
                $relPath = "{$job->project_id}/{$parts[$idx]}";
            }
        }

        if (! Storage::disk('models')->exists($relPath)) {
            throw new ModelNotFoundException("La parte {$part} no existe para este trabajo.");
        }

        return Storage::disk('models')->download($relPath, basename($relPath), [
            'Content-Type' => 'application/octet-stream',
        ]);
    }

    /**
     * Retrieve current conversion job status.
     */
    public function getJobStatus(string $jobId, User $user): array
    {
        $job = ConversionJob::findOrFail($jobId);

        if (! $user->hasAccessToProject($job->project_id)) {
            throw new AccessDeniedHttpException('Acceso denegado a este trabajo de conversión.');
        }

        return [
            'id' => $job->id,
            'projectId' => $job->project_id,
            'status' => $job->status,
            'progress' => $job->progress,
            'error' => $job->error_message,
            'parts' => $job->parts_json ?: [],
            'createdAt' => $job->created_at ? $job->created_at->toISOString() : null,
            'updatedAt' => $job->updated_at ? $job->updated_at->toISOString() : null,
        ];
    }
}
