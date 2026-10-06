<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserService
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function listUsers(?string $query = null): array
    {
        $userQuery = User::query();

        if ($query) {
            $userQuery->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%");
            });
        }

        return $userQuery->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (User $user) => $this->authService->formatUserSummary($user))
            ->all();
    }

    public function getUserById(int|string $id): array
    {
        $user = User::findOrFail($id);
        return $this->authService->formatUserSummary($user);
    }

    public function createUser(array $data): array
    {
        $user = User::create([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => Hash::make($data['password']),
            'role' => $data['role'] ?? 'user',
            'is_active' => $data['isActive'] ?? true,
        ]);

        if (! empty($data['assignedProjectIds']) && is_array($data['assignedProjectIds'])) {
            $user->projects()->sync($data['assignedProjectIds']);
        }

        return $this->authService->formatUserSummary($user);
    }

    public function updateUser(int|string $id, array $data): array
    {
        $user = User::findOrFail($id);

        if (isset($data['name'])) {
            $user->name = trim($data['name']);
        }

        if (isset($data['email'])) {
            $user->email = strtolower(trim($data['email']));
        }

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        if (isset($data['role'])) {
            $user->role = $data['role'];
        }

        if (isset($data['isActive'])) {
            $user->is_active = (bool) $data['isActive'];
        }

        $user->save();

        if (isset($data['assignedProjectIds']) && is_array($data['assignedProjectIds'])) {
            $user->projects()->sync($data['assignedProjectIds']);
        }

        return $this->authService->formatUserSummary($user);
    }

    public function deleteUser(int|string $id): void
    {
        $user = User::findOrFail($id);

        // Prevent deleting the last remaining admin
        if ($user->isAdmin()) {
            $adminsCount = User::where('role', 'admin')->where('is_active', true)->count();
            if ($adminsCount <= 1) {
                throw ValidationException::withMessages([
                    'error' => ['No es posible eliminar al único administrador activo del sistema.'],
                ]);
            }
        }

        $user->delete();
    }

    public function getUserProjectIds(int|string $id): array
    {
        $user = User::findOrFail($id);
        return $user->projects()->pluck('projects.id')->all();
    }

    public function syncUserProjects(int|string $id, array $projectIds): array
    {
        $user = User::findOrFail($id);
        $user->projects()->sync($projectIds);
        return $user->projects()->pluck('projects.id')->all();
    }
}
