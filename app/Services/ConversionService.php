<?php

namespace App\Services;

use App\Jobs\ConvertIfcJob;
use App\Models\BimModel;
use App\Models\ConversionJob;
use App\Services\ActivityLogger;
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

class ConversionService
{
    protected ProjectRepository $projectRepository;
    protected ActivityLogger $activityLogger;

    public function __construct(ProjectRepository $projectRepository, ActivityLogger $activityLogger)
    {
        $this->projectRepository = $projectRepository;
        $this->activityLogger = $activityLogger;
    }

    /**
     * Accepts single IFC upload, preserves intact original in persistent storage, and creates conversion job.
     */
    public function createJob(UploadedFile $file, ?string $projectId, User $user): array
    {
        $originalName = $file->getClientOriginalName();
        $cleanName = basename($originalName);
        $baseName = pathinfo($cleanName, PATHINFO_FILENAME);

        if (! str_ends_with(strtolower($cleanName), '.ifc')) {
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
                'description' => "Proyecto creado automáticamente para {$cleanName}",
            ]);
            if (! $user->isAdmin()) {
                $user->projects()->attach($targetProject->id, ['assigned_at' => now()->timestamp]);
            }
        }

        $jobId = (string) Str::uuid();

        // 1. Store original IFC permanently (intact and separated from temp files)
        $ifcStorageDir = storage_path("app/ifc/{$targetProject->id}");
        if (! file_exists($ifcStorageDir)) {
            mkdir($ifcStorageDir, 0755, true);
        }

        $cleanExt = pathinfo($cleanName, PATHINFO_EXTENSION);
        $intactIfcPath = "{$ifcStorageDir}/{$baseName}_{$jobId}.{$cleanExt}";
        $file->move($ifcStorageDir, basename($intactIfcPath));

        $totalBytes = filesize($intactIfcPath);

        // 2. Persist ConversionJob in database
        $job = ConversionJob::create([
            'id' => $jobId,
            'project_id' => $targetProject->id,
            'user_id' => $user->id,
            'status' => 'queued',
            'progress' => 0,
            'stage' => 'En cola de conversión',
            'original_ifc_name' => $cleanName,
            'original_ifc_path' => $intactIfcPath,
            'total_size_bytes' => $totalBytes,
        ]);
        $this->activityLogger->record('Conversión en cola', 'conversion', $job->id, $cleanName, (string) $targetProject->id, [], $user);

        // 3. Dispatch background job
        ConvertIfcJob::dispatch($job->id, $intactIfcPath, $targetProject->id, $cleanName);
        $this->ensureBackgroundWorkerRunning();

        return [
            'jobId' => $job->id,
            'targetProjectId' => $targetProject->id,
            'progressUrl' => "/api/jobs/{$job->id}/progress",
            'fileName' => $cleanName,
            'totalBytes' => $totalBytes,
        ];
    }

    /**
     * Creates a conversion job from an already assembled intact IFC file (e.g. from chunked upload).
     */
    public function createJobFromAssembledIfc(
        string $intactIfcPath,
        string $originalFileName,
        string $projectId,
        User $user
    ): array {
        if (! file_exists($intactIfcPath)) {
            throw new \InvalidArgumentException("El archivo IFC ensamblado no existe en disco: {$intactIfcPath}");
        }

        $targetProject = $this->projectRepository->findById($projectId, false);
        if (! $targetProject) {
            throw new ModelNotFoundException("Proyecto con ID {$projectId} no encontrado.");
        }

        $jobId = (string) Str::uuid();
        $totalBytes = filesize($intactIfcPath);

        $job = ConversionJob::create([
            'id' => $jobId,
            'project_id' => $targetProject->id,
            'user_id' => $user->id,
            'status' => 'queued',
            'progress' => 0,
            'stage' => 'En cola de conversión',
            'original_ifc_name' => $originalFileName,
            'original_ifc_path' => $intactIfcPath,
            'total_size_bytes' => $totalBytes,
        ]);
        $this->activityLogger->record('Conversión en cola', 'conversion', $job->id, $originalFileName, (string) $targetProject->id, [], $user);

        // Dispatch background job
        ConvertIfcJob::dispatch($job->id, $intactIfcPath, $targetProject->id, $originalFileName);
        $this->ensureBackgroundWorkerRunning();

        return [
            'jobId' => $job->id,
            'targetProjectId' => $targetProject->id,
            'progressUrl' => "/api/jobs/{$job->id}/progress",
            'fileName' => $originalFileName,
            'totalBytes' => $totalBytes,
        ];
    }

    /**
     * Streams real-time SSE progress events to the browser.
     * Persistent and decoupled: if browser disconnects, the conversion job continues running in background.
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

        return response()->stream(function () use ($jobId) {
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
            $lastProgress = -1;
            $lastStage = '';

            // If job is queued, ensure an independent background worker is processing the queue
            $job = ConversionJob::find($jobId);
            if ($job && $job->status === 'queued') {
                $this->ensureBackgroundWorkerRunning();
            }

            // Loop checking database status and stream updates to client
            $maxWaitSec = 7200; // 2 hours
            $startLoop = time();

            while (time() - $startLoop < $maxWaitSec) {
                $job = ConversionJob::find($jobId);
                if (! $job) {
                    $sendEvent('error', ['error' => 'Trabajo no encontrado']);
                    break;
                }

                if ($job->status === 'failed') {
                    $sendEvent('error', ['error' => $job->error_message ?: 'Error desconocido durante la conversión']);
                    break;
                }

                if ($job->status === 'completed') {
                    $parts = $job->parts_json ?: [];
                    $downloadUrls = [];
                    $totalBytes = 0;

                    foreach ($parts as $partName) {
                        $model = BimModel::where('project_id', $job->project_id)->where('name', $partName)->first();
                        if ($model) {
                            $downloadUrls[] = "/api/models/{$model->id}/download";
                            $totalBytes += (int) $model->size_bytes;
                        } else {
                            $downloadUrls[] = "/api/jobs/{$job->id}/download/{$partName}";
                        }
                    }

                    $durationSec = number_format(microtime(true) - $startTime, 2);
                    $totalSizeMB = number_format($totalBytes / (1024 * 1024), 2);

                    $sendEvent('complete', [
                        'parts' => $parts,
                        'downloadUrls' => $downloadUrls,
                        'totalSizeMB' => $totalSizeMB,
                        'durationSec' => $durationSec,
                    ]);
                    break;
                }

                if ($job->progress !== $lastProgress || $job->stage !== $lastStage) {
                    $lastProgress = $job->progress;
                    $lastStage = $job->stage;

                    $sendEvent('progress', [
                        'percent' => $job->progress,
                        'stage' => $job->stage ?: 'Procesando conversión...',
                        'elapsed' => number_format(microtime(true) - $startTime, 1),
                    ]);
                }

                if (connection_aborted()) {
                    // Browser disconnected. The ConvertIfcJob continues running in the background!
                    break;
                }

                usleep(500000); // Poll every 500ms
            }
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

        $relPath = "FragComver/{$job->project_id}/{$part}";

        if (! Storage::disk('models')->exists($relPath)) {
            // Support files created before conversion outputs moved under FragComver.
            $relPath = "{$job->project_id}/{$part}";
        }

        if (! Storage::disk('models')->exists($relPath)) {
            // Also check if part was given by numeric index (1-based)
            $parts = $job->parts_json ?: [];
            $idx = is_numeric($part) ? ((int) $part) - 1 : -1;
            if (isset($parts[$idx])) {
                $relPath = "FragComver/{$job->project_id}/{$parts[$idx]}";
                if (! Storage::disk('models')->exists($relPath)) {
                    $relPath = "{$job->project_id}/{$parts[$idx]}";
                }
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
            'stage' => $job->stage,
            'error' => $job->error_message,
            'parts' => $job->parts_json ?: [],
            'originalIfcName' => $job->original_ifc_name,
            'totalSizeBytes' => $job->total_size_bytes,
            'createdAt' => $job->created_at ? $job->created_at->toISOString() : null,
            'updatedAt' => $job->updated_at ? $job->updated_at->toISOString() : null,
        ];
    }

    /**
     * Spawns an asynchronous background worker process to consume the queued conversion job
     * independently from the HTTP request, resilient to browser disconnection.
     */
    public function ensureBackgroundWorkerRunning(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            $artisan = base_path('artisan');
            $phpBinary = (new \Symfony\Component\Process\PhpExecutableFinder())->find() ?: 'php';

            $process = new \Symfony\Component\Process\Process([
                $phpBinary,
                $artisan,
                'queue:work',
                '--once',
                '--timeout=7200',
                '--tries=1',
            ]);
            $process->setTimeout(null);
            $process->start(); // Asynchronously spawned in background
        } catch (\Throwable $e) {
            // A standing queue daemon may already be handling jobs
        }
    }
}
