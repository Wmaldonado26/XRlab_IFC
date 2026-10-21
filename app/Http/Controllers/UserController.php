<?php

namespace App\Http\Controllers;

use App\Services\UserService;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    protected UserService $userService;
    protected ActivityLogger $activityLogger;

    public function __construct(UserService $userService, ActivityLogger $activityLogger)
    {
        $this->userService = $userService;
        $this->activityLogger = $activityLogger;
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:255',
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'role' => 'sometimes|in:all,admin,user',
            'status' => 'sometimes|in:all,active,inactive',
        ]);

        return response()->json($this->userService->paginateUsers(
            $validated['q'] ?? null,
            $validated['role'] ?? null,
            $validated['status'] ?? null,
            (int) ($validated['per_page'] ?? 25),
        ));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', 'string', Password::min(12)->mixedCase()->numbers()->symbols()],
            'role' => 'nullable|string|in:admin,user',
            'isActive' => 'nullable|boolean',
            'assignedProjectIds' => 'nullable|array',
            'assignedProjectIds.*' => 'string|exists:projects,id',
        ]);

        $user = $this->userService->createUser($validated);
        $this->activityLogger->record('Usuario creado', 'user', $user['id'] ?? null, $user['name'] ?? $validated['name'], null, ['role' => $validated['role'] ?? 'user'], $request->user());

        return response()->json([
            'user' => $user,
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $user = $this->userService->getUserById($id);

        return response()->json([
            'user' => $user,
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'email' => "nullable|email|max:255|unique:users,email,{$id}",
            'password' => ['nullable', 'string', Password::min(12)->mixedCase()->numbers()->symbols()],
            'role' => 'nullable|string|in:admin,user',
            'isActive' => 'nullable|boolean',
            'assignedProjectIds' => 'nullable|array',
            'assignedProjectIds.*' => 'string|exists:projects,id',
        ]);

        $user = $this->userService->updateUser($id, $validated);
        $this->activityLogger->record('Usuario actualizado', 'user', $id, $user['name'] ?? null, null, ['fields' => array_values(array_diff(array_keys($validated), ['password']))], $request->user());

        return response()->json([
            'user' => $user,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        try {
            $target = \App\Models\User::findOrFail($id);
            $this->userService->deleteUser($id);
            $this->activityLogger->record('Usuario eliminado', 'user', $id, $target->name, null, [], $request->user());

            return response()->json([
                'success' => true,
                'message' => 'Usuario eliminado exitosamente.',
            ]);
        } catch (ValidationException $e) {
            $messages = $e->errors();
            $firstMessage = reset($messages)[0] ?? 'Error al eliminar usuario.';

            return response()->json([
                'error' => $firstMessage,
            ], 422);
        }
    }

    public function projects(string $id): JsonResponse
    {
        $projectIds = $this->userService->getUserProjectIds($id);

        return response()->json([
            'assignedProjectIds' => $projectIds,
        ]);
    }

    public function updateProjects(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'projectIds' => 'required|array',
            'projectIds.*' => 'string|exists:projects,id',
        ]);

        $assignedProjectIds = $this->userService->syncUserProjects($id, $validated['projectIds']);
        $target = \App\Models\User::find($id);
        $this->activityLogger->record('Proyectos asignados a usuario', 'user', $id, $target?->name, null, ['project_count' => count($assignedProjectIds)], $request->user());

        return response()->json([
            'assignedProjectIds' => $assignedProjectIds,
        ]);
    }
}
