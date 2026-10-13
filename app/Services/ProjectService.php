<?php

namespace App\Services;

use App\Models\BimModel;
use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ProjectService
{
    protected ProjectRepository $projectRepository;

    public function __construct(ProjectRepository $projectRepository)
    {
        $this->projectRepository = $projectRepository;
    }

    /**
     * List projects visible to the given user.
     */
    public function listProjects(?string $searchQuery, User $user): array
    {
        $projects = $this->projectRepository->listForUser($searchQuery, $user);

        return $projects->map(fn (Project $project) => $this->formatProjectSummary($project))->all();
    }

    /**
     * Retrieve a single project by ID with access control validation.
     */
    public function getProject(string $id, User $user): array
    {
        if (! $user->hasAccessToProject($id)) {
            throw new AccessDeniedHttpException('Acceso denegado. No tiene permisos para consultar este proyecto.');
        }

        $project = $this->projectRepository->findById($id, true);

        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        return $this->formatProjectSummary($project);
    }

    /**
     * Create a new project.
     */
    public function createProject(array $data): array
    {
        $project = $this->projectRepository->create($data);

        // Ensure dedicated project directory in storage
        Storage::disk('models')->makeDirectory($project->id);

        return $this->formatProjectSummary($project);
    }

    /**
     * Update an existing project.
     */
    public function updateProject(string $id, array $data): array
    {
        $project = $this->projectRepository->findById($id, true);

        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        $updated = $this->projectRepository->update($project, $data);

        return $this->formatProjectSummary($updated);
    }

    /**
     * Permanently delete a project, its database records and its physical storage.
     */
    public function deleteProject(string $id): array
    {
        $project = $this->projectRepository->findById($id, true);

        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        // Delete physical files
        Storage::disk('models')->deleteDirectory($id);

        // Delete database records
        $deletedModelsCount = $this->projectRepository->delete($project);

        return [
            'success' => true,
            'deletedModelsCount' => $deletedModelsCount,
            'message' => "Proyecto {$id} y sus {$deletedModelsCount} modelo(s) eliminados exitosamente.",
        ];
    }

    /**
     * Formats project model into standard API summary for the frontend.
     */
    public function formatProjectSummary(Project $project): array
    {
        $models = $project->relationLoaded('bimModels') ? $project->bimModels : $project->bimModels()->get();
        $totalBytes = 0;
        $parts = [];
        $modelDetails = [];

        foreach ($models as $model) {
            $totalBytes += $model->size_bytes;
            $parts[] = $model->name;

            // Check if file physically exists
            $fileExists = Storage::disk('models')->exists($model->storage_path);

            $modelDetails[] = [
                'id' => $model->id,
                'projectId' => $project->id,
                'projectName' => $project->name,
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

        return [
            'id' => $project->id,
            'name' => $project->name,
            'fileName' => $project->name,
            'description' => $project->description,
            'imageUrl' => $project->image_url,
            'createdAt' => $project->created_at ? $project->created_at->timestamp * 1000 : null,
            'modelsCount' => count($modelDetails),
            'models' => $modelDetails,
            'parts' => $parts,
            'fileSize' => $totalBytes,
            'totalPartsSizeMB' => number_format($totalBytes / (1024 * 1024), 2, '.', ''),
        ];
    }

    /**
     * Upload and save cover image for project.
     */
    public function uploadCoverImage(string $id, UploadedFile $file, User $user): array
    {
        if (! $user->isAdmin()) {
            throw new AccessDeniedHttpException('Se requieren permisos de administrador para modificar la portada.');
        }

        $project = $this->projectRepository->findById($id, true);
        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])) {
            throw new \InvalidArgumentException('Formato de imagen no soportado. Se admiten JPG, PNG, WEBP, GIF o SVG.');
        }

        // Clean up previous cover image files if any
        $files = Storage::disk('models')->files($project->id);
        foreach ($files as $f) {
            if (preg_match('/^' . preg_quote($project->id, '/') . '\/cover(_[0-9]+)?\.[a-z0-9]+$/i', $f)) {
                Storage::disk('models')->delete($f);
            }
        }

        $timestamp = time();
        $filename = "cover_{$timestamp}.{$ext}";
        Storage::disk('models')->putFileAs($project->id, $file, $filename);

        $imageUrl = "/api/projects/{$project->id}/cover?t={$timestamp}";
        $updated = $this->projectRepository->update($project, ['image_url' => $imageUrl]);

        return $this->formatProjectSummary($updated);
    }

    /**
     * Delete cover image for project.
     */
    public function deleteCoverImage(string $id, User $user): array
    {
        if (! $user->isAdmin()) {
            throw new AccessDeniedHttpException('Se requieren permisos de administrador para eliminar la portada.');
        }

        $project = $this->projectRepository->findById($id, true);
        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        $files = Storage::disk('models')->files($project->id);
        foreach ($files as $f) {
            if (preg_match('/^' . preg_quote($project->id, '/') . '\/cover(_[0-9]+)?\.[a-z0-9]+$/i', $f)) {
                Storage::disk('models')->delete($f);
            }
        }

        $updated = $this->projectRepository->update($project, ['image_url' => null]);

        return $this->formatProjectSummary($updated);
    }

    /**
     * Retrieve cover image binary file for streaming.
     */
    public function getCoverImageFile(string $id): Response
    {
        $project = $this->projectRepository->findById($id, false);
        if (! $project) {
            throw new ModelNotFoundException("Proyecto con ID {$id} no encontrado.");
        }

        // Find cover file in project folder
        $files = Storage::disk('models')->files($id);
        $coverFile = null;
        foreach ($files as $f) {
            if (preg_match('/^' . preg_quote($id, '/') . '\/cover(_[0-9]+)?\.[a-z0-9]+$/i', $f)) {
                $coverFile = $f;
                break;
            }
        }

        if (! $coverFile || ! Storage::disk('models')->exists($coverFile)) {
            if (! empty($project->image_url) && str_starts_with($project->image_url, 'http')) {
                return redirect($project->image_url);
            }
            throw new ModelNotFoundException("No se encontró imagen de portada para el proyecto.");
        }

        $fullPath = Storage::disk('models')->path($coverFile);
        $mime = Storage::disk('models')->mimeType($coverFile) ?: 'image/jpeg';

        return response()->file($fullPath, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Helper to format bytes to human-readable strings.
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
