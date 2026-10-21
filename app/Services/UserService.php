<?php

namespace App\Services;

use App\Models\User;
use App\Models\Project;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class UserService
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function paginateUsers(
        ?string $query = null,
        ?string $role = null,
        ?string $status = null,
        int $perPage = 25
    ): array {
        $paginator = $this->userQuery($query, $role, $status)
            ->with('projects:id')
            ->paginate($perPage)
            ->withQueryString();
        $users = $paginator->getCollection();
        $adminProjectIds = $users->contains(fn (User $user) => $user->isAdmin())
            ? Project::pluck('id')->all()
            : [];

        return [
            'users' => $users
                ->map(fn (User $user) => $this->authService->formatUserSummary($user, $adminProjectIds))
                ->all(),
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    private function userQuery(?string $query = null, ?string $role = null, ?string $status = null): Builder
    {
        return User::query()
            ->when($query !== null && trim($query) !== '', function (Builder $builder) use ($query): void {
                $term = trim($query);
                $builder->where(function (Builder $search) use ($term): void {
                    $search->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%");
                });
            })
            ->when($role !== null && $role !== 'all', fn (Builder $builder) => $builder->where('role', $role))
            ->when($status === 'active', fn (Builder $builder) => $builder->where('is_active', true))
            ->when($status === 'inactive', fn (Builder $builder) => $builder->where('is_active', false))
            ->orderByDesc('created_at')
            ->orderBy('id');
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
        return DB::transaction(function () use ($id, $data): array {
        $activeAdmins = User::where('role', 'admin')->where('is_active', true)->lockForUpdate()->get();
        $user = User::lockForUpdate()->findOrFail($id);
        $wasActiveAdmin = $user->isAdmin() && $user->is_active;
        $passwordChanged = ! empty($data['password']);

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

        if ($wasActiveAdmin && ($user->role !== 'admin' || ! $user->is_active)
            && $activeAdmins->count() <= 1) {
            throw ValidationException::withMessages([
                'error' => ['No es posible desactivar o cambiar el rol del unico administrador activo.'],
            ]);
        }

        $user->save();

        if ($passwordChanged) {
            $this->revokeDatabaseSessions($user->id);
        }

        if (isset($data['assignedProjectIds']) && is_array($data['assignedProjectIds'])) {
            $user->projects()->sync($data['assignedProjectIds']);
        }

        return $this->authService->formatUserSummary($user);
        });
    }

    public function deleteUser(int|string $id): void
    {
        DB::transaction(function () use ($id): void {
        $activeAdmins = User::where('role', 'admin')->where('is_active', true)->lockForUpdate()->get();
        $user = User::lockForUpdate()->findOrFail($id);

        // Prevent deleting the last remaining admin
        if ($user->isAdmin() && $user->is_active) {
            if ($activeAdmins->count() <= 1) {
                throw ValidationException::withMessages([
                    'error' => ['No es posible eliminar al único administrador activo del sistema.'],
                ]);
            }
        }

        $user->delete();
        $this->revokeDatabaseSessions($user->id);
        });
    }

    private function revokeDatabaseSessions(int|string $userId): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        DB::table(config('session.table', 'sessions'))
            ->where('user_id', $userId)
            ->delete();
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
