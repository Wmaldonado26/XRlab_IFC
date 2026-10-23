<?php

namespace App\Services;

use App\Models\BimModel;
use App\Models\User;
use App\Repositories\ModelRepository;
use App\Repositories\ProjectRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ModelService
{
    protected ModelRepository $modelRepository;
    protected ProjectRepository $projectRepository;

    public function __construct(ModelRepository $modelRepository, ProjectRepository $projectRepository)
    {
        $this->modelRepository = $modelRepository;
        $this->projectRepository = $projectRepository;
    }

    /**
     * List models with permission isolation and optional filters.
     */
    public function listModels(
        ?string $searchQuery,
        ?string $projectId,
        ?string $status,
        User $user
    ): array {
        // Guard against requesting projects the user is not assigned to
        if (! $user->isAdmin() && ! empty($projectId) && $projectId !== 'all') {
            if (! $user->hasAccessToProject($projectId)) {
                throw new AccessDeniedHttpException('Acceso denegado a los modelos del proyecto solicitado.');
            }
        }

        $models = $this->modelRepository->listForUser($searchQuery, $projectId, $status, $user);

        return $models->map(fn (BimModel $model) => $this->formatModelDetail($model))->all();
    }

    /**
     * Retrieve single model details.
     */
    public function getModelDetail(string $id, User $user): array
    {
        $model = $this->modelRepository->findById($id);

        if (! $model) {
            throw new ModelNotFoundException("Modelo con ID {$id} no encontrado.");
        }

        if (! $user->hasAccessToProject($model->project_id)) {
            throw new AccessDeniedHttpException('Acceso denegado al modelo solicitado.');
        }

        return $this->formatModelDetail($model);
    }

    /**
     * Upload a pre-converted .frag model directly into the project storage and register in DB.
     */
    public function uploadDirectFrag(string $projectId, UploadedFile $file, User $user): array
    {
        if (! $user->isAdmin()) {
            throw new AccessDeniedHttpException('Se requieren permisos de administrador para subir modelos.');
        }

        $project = $this->projectRepository->findById($projectId, false);
        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$projectId} no encontrado.");
        }

        $originalName = $file->getClientOriginalName();
        $cleanName = basename($originalName);

        if (! str_ends_with(strtolower($cleanName), '.frag')) {
            throw new \InvalidArgumentException('Solo se admiten archivos con extensión .frag.');
        }

        // Store file in disk 'models' under project directory
        $storageRelPath = "{$projectId}/{$cleanName}";
        Storage::disk('models')->putFileAs($projectId, $file, $cleanName);

        $sizeBytes = $file->getSize();

        // Atomically register or update model in DB
        $model = $this->modelRepository->create([
            'project_id' => $projectId,
            'name' => $cleanName,
            'storage_path' => $storageRelPath,
            'size_bytes' => $sizeBytes,
            'status' => 'ready',
        ]);

        return $this->formatModelDetail($model);
    }

    /**
     * Streams binary .frag file to authorized client.
     */
    public function downloadModelFile(string $id, User $user): StreamedResponse|BinaryFileResponse
    {
        $model = $this->modelRepository->findById($id);

        if (! $model) {
            // Fallback: search by name across accessible projects if a single match exists
            $accessibleProjectIds = $user->isAdmin()
                ? null
                : $user->projects()->pluck('projects.id')->toArray();

            $query = BimModel::query()->with('project')->where('name', $id);
            if ($accessibleProjectIds !== null) {
                $query->whereIn('project_id', $accessibleProjectIds);
            }
            $matches = $query->get();
            if ($matches->count() === 1) {
                $model = $matches->first();
            }
        }

        if (! $model) {
            throw new ModelNotFoundException("Modelo con ID {$id} no encontrado.");
        }

        if (! $user->hasAccessToProject($model->project_id)) {
            throw new AccessDeniedHttpException('Acceso denegado. No tiene permisos para descargar modelos de este proyecto.');
        }

        if (! Storage::disk('models')->exists($model->storage_path)) {
            throw new ModelNotFoundException("El archivo físico del modelo {$model->name} no existe en disco.");
        }

        return Storage::disk('models')->download($model->storage_path, $model->name, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'no-cache, private',
        ]);
    }

    /**
     * Streams binary .frag file strictly scoped to a project (supports canonical UUID or filename).
     */
    public function downloadProjectModelFile(string $projectId, string $modelIdentifier, User $user): StreamedResponse|BinaryFileResponse
    {
        if (! $user->hasAccessToProject($projectId)) {
            throw new AccessDeniedHttpException('Acceso denegado. No tiene permisos para descargar modelos de este proyecto.');
        }

        $model = $this->modelRepository->findInProject($projectId, $modelIdentifier);

        if (! $model) {
            throw new ModelNotFoundException("Modelo con identificador {$modelIdentifier} no encontrado en el proyecto.");
        }

        if (! Storage::disk('models')->exists($model->storage_path)) {
            throw new ModelNotFoundException("El archivo físico del modelo {$model->name} no existe en disco.");
        }

        return Storage::disk('models')->download($model->storage_path, $model->name, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'no-cache, private',
        ]);
    }

    /**
     * Permanently delete model record and its storage file (Admin only).
     */
    public function deleteModel(string $id, User $user): array
    {
        if (! $user->isAdmin()) {
            throw new AccessDeniedHttpException('Se requieren permisos de administrador para eliminar modelos.');
        }

        $model = $this->modelRepository->findById($id);

        if (! $model) {
            throw new ModelNotFoundException("Modelo con ID {$id} no encontrado.");
        }

        $modelName = $model->name;
        $projectId = $model->project_id;

        // Delete physical file
        if (Storage::disk('models')->exists($model->storage_path)) {
            Storage::disk('models')->delete($model->storage_path);
        }

        $this->modelRepository->delete($model);

        return [
            'success' => true,
            'message' => "Modelo {$modelName} eliminado exitosamente.",
            'modelName' => $modelName,
            'projectId' => $projectId,
        ];
    }

    /**
     * Format BimModel Eloquent instance into BackendModelItem contract.
     */
    public function formatModelDetail(BimModel $model): array
    {
        $fileExists = Storage::disk('models')->exists($model->storage_path);

        return [
            'id' => $model->id,
            'projectId' => $model->project_id,
            'projectName' => $model->project ? $model->project->name : null,
            'name' => $model->name,
            'storagePath' => $model->storage_path,
            'sizeBytes' => $model->size_bytes,
            'status' => $fileExists ? $model->status : 'missing_file',
            'fileExists' => $fileExists,
            'sizeFormatted' => $this->formatBytes($model->size_bytes),
            'createdAt' => $model->created_at ? $model->created_at->timestamp * 1000 : null,
            'updatedAt' => $model->updated_at ? $model->updated_at->timestamp * 1000 : null,
        ];
    }

    /**
     * Helper to format bytes to human-readable string.
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));
        $val = round($bytes / pow(1024, $i), 2);
        return "{$val} {$units[$i]}";
    }
}
