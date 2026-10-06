<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ProjectRepository
{
    /**
     * List all projects visible to the given user, with optional search query.
     */
    public function listForUser(?string $searchQuery, User $user): Collection
    {
        $query = Project::query()->with(['bimModels' => function ($q) {
            $q->orderBy('name', 'asc');
        }]);

        // Row-level permission isolation: standard users only see projects assigned to them
        if (! $user->isAdmin()) {
            $query->whereHas('users', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            });
        }

        if (! empty($searchQuery)) {
            $clean = strtolower(trim($searchQuery));
            $query->where(function ($q) use ($clean) {
                $q->whereRaw('lower(name) like ?', ["%{$clean}%"])
                    ->orWhereRaw('lower(coalesce(description, "")) like ?', ["%{$clean}%"]);
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Find project by ID, optionally loading BIM models.
     */
    public function findById(string $id, bool $loadModels = true): ?Project
    {
        $query = Project::query();

        if ($loadModels) {
            $query->with(['bimModels' => function ($q) {
                $q->orderBy('name', 'asc');
            }]);
        }

        return $query->find($id);
    }

    /**
     * Create a new project.
     */
    public function create(array $data): Project
    {
        return Project::create([
            'name' => trim($data['name']),
            'description' => isset($data['description']) ? trim($data['description']) : null,
        ]);
    }

    /**
     * Update an existing project.
     */
    public function update(Project $project, array $data): Project
    {
        $fillable = [];
        if (isset($data['name'])) {
            $fillable['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $fillable['description'] = $data['description'] !== null ? trim($data['description']) : null;
        }

        $project->update($fillable);
        return $project->fresh();
    }

    /**
     * Permanently delete project and return the count of deleted BIM models.
     */
    public function delete(Project $project): int
    {
        return DB::transaction(function () use ($project) {
            $modelsCount = $project->bimModels()->count();
            $project->bimModels()->delete();
            $project->users()->detach();
            $project->conversionJobs()->delete();
            $project->delete();

            return $modelsCount;
        });
    }
}
