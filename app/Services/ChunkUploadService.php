<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ChunkUploadService
{
    protected ProjectRepository $projectRepository;

    public function __construct(ProjectRepository $projectRepository)
    {
        $this->projectRepository = $projectRepository;
    }

    /**
     * Get base directory for temporary chunk uploads.
     */
    protected function getTempUploadDir(string $uploadId): string
    {
        // Sanitize uploadId to prevent directory traversal
        $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '', $uploadId);
        return storage_path("app/temp/uploads/{$safeId}");
    }

    /**
     * Initializes a chunked upload session.
     */
    public function initUpload(
        string $fileName,
        int $totalBytes,
        int $totalChunks,
        int $chunkSize,
        ?string $projectId,
        User $user
    ): array {
        $cleanName = basename($fileName);
        if (! str_ends_with(strtolower($cleanName), '.ifc')) {
            throw new \InvalidArgumentException('Solo se admiten archivos con formato IFC (.ifc).');
        }

        if ($totalBytes <= 0) {
            throw new \InvalidArgumentException('El tamaño del archivo debe ser mayor a 0 bytes.');
        }

        if ($totalChunks <= 0) {
            throw new \InvalidArgumentException('El número total de partes debe ser mayor a 0.');
        }

        // Validate or create project
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
            $baseName = pathinfo($cleanName, PATHINFO_FILENAME);
            $targetProject = $this->projectRepository->create([
                'name' => $baseName,
                'description' => "Proyecto creado automáticamente para {$cleanName}",
            ]);
            if (! $user->isAdmin()) {
                $user->projects()->attach($targetProject->id, ['assigned_at' => now()->timestamp]);
            }
        }

        // Garbage collect abandoned temporary upload sessions older than 24 hours
        $this->cleanAbandonedUploads();

        $uploadId = (string) Str::uuid();
        $dir = $this->getTempUploadDir($uploadId);

        if (! file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        $manifest = [
            'uploadId' => $uploadId,
            'fileName' => $cleanName,
            'totalBytes' => $totalBytes,
            'totalChunks' => $totalChunks,
            'chunkSize' => $chunkSize,
            'projectId' => $targetProject->id,
            'userId' => (string) $user->id,
            'createdAt' => time(),
        ];

        file_put_contents("{$dir}/manifest.json", json_encode($manifest, JSON_PRETTY_PRINT));

        return [
            'uploadId' => $uploadId,
            'projectId' => $targetProject->id,
            'chunkSize' => $chunkSize,
            'totalChunks' => $totalChunks,
            'totalBytes' => $totalBytes,
        ];
    }

    /**
     * Cleans up temporary upload directories abandoned for more than the specified duration.
     */
    public function cleanAbandonedUploads(int $maxAgeSeconds = 86400): int
    {
        $baseTempDir = storage_path('app/temp/uploads');
        if (! file_exists($baseTempDir) || ! is_dir($baseTempDir)) {
            return 0;
        }

        $cleanedCount = 0;
        $now = time();
        $dirs = glob("{$baseTempDir}/*", GLOB_ONLYDIR);

        if ($dirs) {
            foreach ($dirs as $uploadDir) {
                $manifestPath = "{$uploadDir}/manifest.json";
                $createdAt = file_exists($manifestPath)
                    ? (int) (json_decode(file_get_contents($manifestPath), true)['createdAt'] ?? filemtime($uploadDir))
                    : filemtime($uploadDir);

                if (($now - $createdAt) > $maxAgeSeconds) {
                    try {
                        $files = glob("{$uploadDir}/*");
                        if ($files) {
                            foreach ($files as $file) {
                                if (is_file($file)) {
                                    @unlink($file);
                                }
                            }
                        }
                        @rmdir($uploadDir);
                        $cleanedCount++;
                    } catch (\Throwable $e) {
                        // Ignore cleanup errors
                    }
                }
            }
        }

        return $cleanedCount;
    }

    /**
     * Stores an uploaded chunk streamingly without keeping large buffers in memory.
     */
    public function saveChunk(
        string $uploadId,
        int $chunkIndex,
        UploadedFile $chunkFile,
        User $user
    ): array {
        $dir = $this->getTempUploadDir($uploadId);
        $manifestPath = "{$dir}/manifest.json";

        if (! file_exists($manifestPath)) {
            throw new ModelNotFoundException("Sesión de carga {$uploadId} no encontrada.");
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if ((string) ($manifest['userId'] ?? '') !== (string) $user->id && ! $user->isAdmin()) {
            throw new AccessDeniedHttpException('No autorizado para modificar esta carga.');
        }

        if ($chunkIndex < 0 || $chunkIndex >= $manifest['totalChunks']) {
            throw new \InvalidArgumentException("Índice de chunk {$chunkIndex} fuera de rango.");
        }

        if (! $chunkFile->isValid() || $chunkFile->getSize() <= 0) {
            throw new \InvalidArgumentException("El archivo de la parte {$chunkIndex} es inválido o está vacío.");
        }

        $chunkPath = "{$dir}/chunk_" . sprintf('%06d', $chunkIndex) . '.part';
        
        // Move chunk file to target path
        $chunkFile->move($dir, basename($chunkPath));

        return [
            'uploadId' => $uploadId,
            'chunkIndex' => $chunkIndex,
            'receivedBytes' => filesize($chunkPath),
        ];
    }

    /**
     * Retrieves the status of an ongoing upload, listing all received chunks to enable resume.
     */
    public function getUploadStatus(string $uploadId, User $user): array
    {
        $dir = $this->getTempUploadDir($uploadId);
        $manifestPath = "{$dir}/manifest.json";

        if (! file_exists($manifestPath)) {
            throw new ModelNotFoundException("Sesión de carga {$uploadId} no encontrada.");
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if ((string) ($manifest['userId'] ?? '') !== (string) $user->id && ! $user->isAdmin()) {
            throw new AccessDeniedHttpException('No autorizado para consultar esta carga.');
        }

        $uploadedChunks = [];
        $uploadedBytes = 0;

        for ($i = 0; $i < $manifest['totalChunks']; $i++) {
            $chunkPath = "{$dir}/chunk_" . sprintf('%06d', $i) . '.part';
            if (file_exists($chunkPath)) {
                $uploadedChunks[] = $i;
                $uploadedBytes += filesize($chunkPath);
            }
        }

        return [
            'uploadId' => $uploadId,
            'fileName' => $manifest['fileName'],
            'totalChunks' => $manifest['totalChunks'],
            'totalBytes' => $manifest['totalBytes'],
            'uploadedChunks' => $uploadedChunks,
            'uploadedBytes' => $uploadedBytes,
            'isComplete' => count($uploadedChunks) === $manifest['totalChunks'],
        ];
    }

    /**
     * Assembles all chunks in order via streaming to form the intact original IFC file.
     * Verifies file size and STEP header integrity, and returns the assembled path.
     */
    public function completeUpload(string $uploadId, User $user): array
    {
        $dir = $this->getTempUploadDir($uploadId);
        $manifestPath = "{$dir}/manifest.json";

        if (! file_exists($manifestPath)) {
            throw new ModelNotFoundException("Sesión de carga {$uploadId} no encontrada.");
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if ((string) ($manifest['userId'] ?? '') !== (string) $user->id && ! $user->isAdmin()) {
            throw new AccessDeniedHttpException('No autorizado para completar esta carga.');
        }

        $totalChunks = (int) $manifest['totalChunks'];
        $expectedTotalBytes = (int) $manifest['totalBytes'];
        $projectId = $manifest['projectId'];
        $fileName = $manifest['fileName'];

        // 1. Verify all chunks are present
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = "{$dir}/chunk_" . sprintf('%06d', $i) . '.part';
            if (! file_exists($chunkPath)) {
                throw new \InvalidArgumentException("Falta la parte #{$i} de la carga. No se puede ensamblar.");
            }
        }

        // 2. Prepare permanent destination for the intact original IFC
        $ifcStorageDir = storage_path("app/ifc/{$projectId}");
        if (! file_exists($ifcStorageDir)) {
            mkdir($ifcStorageDir, 0755, true);
        }

        // Generate clean unique filename for permanent storage while preserving extension
        $cleanBase = pathinfo($fileName, PATHINFO_FILENAME);
        $cleanExt = pathinfo($fileName, PATHINFO_EXTENSION);
        $intactIfcPath = "{$ifcStorageDir}/{$cleanBase}_{$uploadId}.{$cleanExt}";

        // 3. Assemble chunks streamingly (Zero memory overhead in PHP)
        $outHandle = fopen($intactIfcPath, 'wb');
        if (! $outHandle) {
            throw new \RuntimeException("No se pudo crear el archivo de destino {$intactIfcPath}");
        }

        try {
            for ($i = 0; $i < $totalChunks; $i++) {
                $chunkPath = "{$dir}/chunk_" . sprintf('%06d', $i) . '.part';
                $inHandle = fopen($chunkPath, 'rb');
                if (! $inHandle) {
                    throw new \RuntimeException("No se pudo leer la parte {$chunkPath}");
                }
                stream_copy_to_stream($inHandle, $outHandle);
                fclose($inHandle);
            }
        } finally {
            fclose($outHandle);
        }

        // 4. Validate assembled file size
        $assembledSize = filesize($intactIfcPath);
        if ($assembledSize !== $expectedTotalBytes) {
            unlink($intactIfcPath);
            throw new \RuntimeException("Fallo de integridad: el tamaño ensamblado ({$assembledSize} bytes) no coincide con el esperado ({$expectedTotalBytes} bytes).");
        }

        // 5. Validate IFC STEP Header (First 1024 bytes must contain ISO-10303-21)
        $fh = fopen($intactIfcPath, 'rb');
        $headerCheck = fread($fh, 2048);
        fclose($fh);

        if (! str_contains(strtoupper($headerCheck), 'ISO-10303-21') && ! str_contains(strtoupper($headerCheck), 'HEADER;')) {
            unlink($intactIfcPath);
            throw new \InvalidArgumentException('El archivo ensamblado no es un archivo STEP/IFC válido (cabecera ISO-10303-21 ausente).');
        }

        // 6. Clean up temporary chunk files safely
        try {
            for ($i = 0; $i < $totalChunks; $i++) {
                $chunkPath = "{$dir}/chunk_" . sprintf('%06d', $i) . '.part';
                if (file_exists($chunkPath)) {
                    unlink($chunkPath);
                }
            }
            if (file_exists($manifestPath)) {
                unlink($manifestPath);
            }
            @rmdir($dir);
        } catch (\Throwable $e) {
            // Non-fatal cleanup
        }

        return [
            'uploadId' => $uploadId,
            'projectId' => $projectId,
            'fileName' => $fileName,
            'intactIfcPath' => $intactIfcPath,
            'totalBytes' => $assembledSize,
        ];
    }

    /**
     * Cancels an upload session and cleans up all uploaded parts.
     */
    public function cancelUpload(string $uploadId, User $user): bool
    {
        $dir = $this->getTempUploadDir($uploadId);
        $manifestPath = "{$dir}/manifest.json";

        if (! file_exists($manifestPath)) {
            return false;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        if ((string) ($manifest['userId'] ?? '') !== (string) $user->id && ! $user->isAdmin()) {
            throw new AccessDeniedHttpException('No autorizado para cancelar esta carga.');
        }

        try {
            $files = glob("{$dir}/*");
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            @rmdir($dir);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
