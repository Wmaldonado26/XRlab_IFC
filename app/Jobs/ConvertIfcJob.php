<?php

namespace App\Jobs;

use App\Models\BimModel;
use App\Models\ConversionJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class ConvertIfcJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 7200; // 2 hours for massive models (e.g. 3.58+ GB)
    public int $tries = 1;

    public string $jobId;
    public string $intactIfcPath;
    public string $projectId;
    public string $originalFileName;

    public function __construct(string $jobId, string $intactIfcPath, string $projectId, string $originalFileName)
    {
        $this->jobId = $jobId;
        $this->intactIfcPath = $intactIfcPath;
        $this->projectId = $projectId;
        $this->originalFileName = $originalFileName;
    }

    public function handle(): void
    {
        $job = ConversionJob::find($this->jobId);
        if (! $job) {
            Log::error("[ConvertIfcJob] ConversionJob {$this->jobId} not found in database.");
            return;
        }

        $tempDir = storage_path("app/temp/conversions/{$this->jobId}");
        if (! file_exists($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $logFile = "{$tempDir}/progress.log";
        $appendLog = function (string $line) use ($logFile) {
            file_put_contents($logFile, date('Y-m-d H:i:s') . " - {$line}\n", FILE_APPEND);
        };

        $appendLog("Iniciando trabajo de conversión para {$this->originalFileName}");

        if (! file_exists($this->intactIfcPath)) {
            $errorMsg = "Archivo IFC fuente intacto no encontrado: {$this->intactIfcPath}";
            $job->update([
                'status' => 'failed',
                'error_message' => $errorMsg,
                'stage' => 'Error: Archivo no encontrado',
            ]);
            $appendLog("ERROR: {$errorMsg}");
            app(\App\Services\ActivityLogger::class)->record('Conversión fallida', 'conversion', $job->id, $job->original_ifc_name, (string) $job->project_id, [], $job->user);
            return;
        }

        $totalBytes = filesize($this->intactIfcPath);
        $job->update([
            'status' => 'processing',
            'progress' => 5,
            'stage' => 'Iniciando pipeline de conversión Node.js...',
            'original_ifc_name' => $this->originalFileName,
            'original_ifc_path' => $this->intactIfcPath,
            'total_size_bytes' => $totalBytes,
        ]);

        $safeBaseName = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($this->originalFileName, PATHINFO_FILENAME));
        $outputFrag = "{$tempDir}/{$safeBaseName}_{$this->jobId}.frag";
        $scriptPath = base_path('scripts/convert-ifc.js');
        $nodePath = 'node';

        $process = new Process([
            $nodePath,
            '--max-old-space-size=16384',
            $scriptPath,
            $this->intactIfcPath,
            $outputFrag,
        ]);
        $process->setTimeout($this->timeout);

        $lastPct = 5;
        $appendLog("Ejecutando proceso Node.js con --max-old-space-size=16384");

        try {
            $process->run(function ($type, $buffer) use (&$lastPct, $job, $appendLog) {
                $appendLog(trim($buffer));

                // Parse progress percentages if emitted in stdout
                if (preg_match('/(\d{1,3})%/', $buffer, $matches)) {
                    $pct = (int) $matches[1];
                    // Map 0-100 of conversion to 5-90% of overall job
                    $mappedPct = (int) round(5 + ($pct * 0.85));
                    if ($mappedPct > $lastPct && $mappedPct < 92) {
                        $lastPct = $mappedPct;
                        $job->update([
                            'progress' => $mappedPct,
                            'stage' => 'Procesando geometría y relaciones IFC...',
                        ]);
                    }
                } elseif (str_contains($buffer, 'Pass 1')) {
                    $job->update(['stage' => 'Escaneando referencias cruzadas de entidades...']);
                } elseif (str_contains($buffer, 'Pass 2')) {
                    $job->update(['stage' => 'Generando sub-modelos balanceados...']);
                } elseif (str_contains($buffer, 'CONVERTING')) {
                    $job->update(['stage' => 'Compilando fragmentos 3D (.frag)...']);
                }
            });

            if (! $process->isSuccessful()) {
                $errorMsg = $process->getErrorOutput() ?: $process->getOutput() ?: 'Fallo en la ejecución del conversor Node.js';
                $job->update([
                    'status' => 'failed',
                    'error_message' => $errorMsg,
                    'stage' => 'Fallo en conversión',
                ]);
                $appendLog("ERROR: {$errorMsg}");
                app(\App\Services\ActivityLogger::class)->record('Conversión fallida', 'conversion', $job->id, $job->original_ifc_name, (string) $job->project_id, [], $job->user);
                return;
            }

            // Find generated .frag files
            $fragFiles = glob("{$tempDir}/*.frag");
            if (empty($fragFiles) && file_exists($outputFrag)) {
                $fragFiles = [$outputFrag];
            }

            if (empty($fragFiles)) {
                $errorMsg = 'El conversor finalizó pero no generó archivos .frag en el directorio de salida.';
                $job->update([
                    'status' => 'failed',
                    'error_message' => $errorMsg,
                    'stage' => 'Error: Fragmentos no encontrados',
                ]);
                $appendLog("ERROR: {$errorMsg}");
                app(\App\Services\ActivityLogger::class)->record('Conversión fallida', 'conversion', $job->id, $job->original_ifc_name, (string) $job->project_id, [], $job->user);
                return;
            }

            if (count($fragFiles) !== 1) {
                throw new \RuntimeException('Conversion must produce exactly one .frag file.');
            }

            $job->update([
                'status' => 'validating',
                'progress' => 92,
                'stage' => 'Validando fragmentos 3D generados...',
            ]);

            $parts = [];
            $totalFragBytes = 0;

            foreach ($fragFiles as $fragAbsPath) {
                $partName = basename($fragAbsPath);
                $fileSize = filesize($fragAbsPath);

                if ($fileSize <= 0) {
                    throw new \RuntimeException("Fragmento generado corrupto o vacío: {$partName}");
                }

                $totalFragBytes += $fileSize;
                $relStoragePath = "FragComver/{$this->projectId}/{$partName}";

                // Stream copy to storage disk 'models' (never load full file into PHP memory!)
                $stream = fopen($fragAbsPath, 'rb');
                if (! $stream) {
                    throw new \RuntimeException("No se pudo abrir el fragmento {$fragAbsPath} para lectura.");
                }

                Storage::disk('models')->put($relStoragePath, $stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }

                // Verify file stored successfully
                if (! Storage::disk('models')->exists($relStoragePath) || Storage::disk('models')->size($relStoragePath) !== $fileSize) {
                    throw new \RuntimeException("Fallo al escribir el fragmento {$partName} en el almacenamiento.");
                }

                // Register BimModel record in database
                BimModel::updateOrCreate(
                    [
                        'project_id' => $this->projectId,
                        'name' => $partName,
                    ],
                    [
                        'storage_path' => $relStoragePath,
                        'size_bytes' => $fileSize,
                        'status' => 'ready',
                    ]
                );

                $parts[] = $partName;
            }

            // Clean temporary conversion files safely (original IFC in $this->intactIfcPath is PRESERVED)
            try {
                foreach ($fragFiles as $fragAbsPath) {
                    if (file_exists($fragAbsPath)) {
                        unlink($fragAbsPath);
                    }
                }
                // Remove intermediate temp splits if any remained
                $tempSplits = glob("{$tempDir}/*.ifc");
                foreach ($tempSplits as $splitFile) {
                    if ($splitFile !== $this->intactIfcPath && file_exists($splitFile)) {
                        unlink($splitFile);
                    }
                }
            } catch (\Throwable $e) {
                // Non-fatal
            }

            $job->update([
                'status' => 'completed',
                'progress' => 100,
                'stage' => 'Completado con éxito',
                'parts_json' => $parts,
            ]);

            $appendLog("Conversión finalizada exitosamente. Partes: " . implode(', ', $parts));
            app(\App\Services\ActivityLogger::class)->record('Conversión completada', 'conversion', $job->id, $job->original_ifc_name, (string) $job->project_id, ['part_count' => count($parts)], $job->user);
        } catch (\Throwable $e) {
            Log::error("[ConvertIfcJob] Exception during conversion: " . $e->getMessage(), ['exception' => $e]);
            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'stage' => 'Error: ' . substr($e->getMessage(), 0, 80),
            ]);
            $appendLog("EXCEPTION: " . $e->getMessage());
            app(\App\Services\ActivityLogger::class)->record('Conversión fallida', 'conversion', $job->id, $job->original_ifc_name, (string) $job->project_id, [], $job->user);
        }
    }
}
