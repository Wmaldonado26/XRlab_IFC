<?php

namespace App\Repositories;

use App\Models\BimModel;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class ModelRepository
{
    /**
     * List models with row-level permission isolation based on user project assignments.
     */
    public function listForUser(
        ?string $searchQuery,
        ?string $projectId,
        ?string $status,
        User $user
    ): Collection {
        $query = BimModel::query()->with('project');

        // Isolation: standard users can ONLY view models from projects assigned to them
        if (! $user->isAdmin()) {
            $query->whereHas('project.users', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            });
        }

        if (! empty($projectId) && $projectId !== 'all') {
            $query->where('project_id', $projectId);
        }

        if (! empty($status)) {
            $query->where('status', $status);
        }

        if (! empty($searchQuery)) {
            $clean = strtolower(trim($searchQuery));
            $query->where(function ($q) use ($clean) {
                $q->whereRaw('lower(name) like ?', ["%{$clean}%"])
                    ->orWhereHas('project', function ($sub) use ($clean) {
                        $sub->whereRaw('lower(name) like ?', ["%{$clean}%"]);
                    });
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Find a model by ID with its parent project.
     */
    public function findById(string $id): ?BimModel
    {
        return BimModel::query()->with('project')->find($id);
    }

    /**
     * Find a model strictly within a specific project by canonical UUID or file name.
     */
    public function findInProject(string $projectId, string $identifier): ?BimModel
    {
        return BimModel::query()
            ->with('project')
            ->where('project_id', $projectId)
            ->where(function ($q) use ($identifier) {
                $q->where('id', $identifier)
                  ->orWhere('name', $identifier);
            })
            ->first();
    }

    /**
     * Create a new model record.
     */
    public function create(array $data): BimModel
    {
        return BimModel::create([
            'project_id' => $data['project_id'],
            'name' => $data['name'],
            'storage_path' => $data['storage_path'],
            'size_bytes' => $data['size_bytes'],
            'status' => $data['status'] ?? 'ready',
        ]);
    }

    /**
     * Delete model record.
     */
    public function delete(BimModel $model): bool
    {
        return (bool) $model->delete();
    }
}
