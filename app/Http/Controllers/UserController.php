<?php

namespace App\Http\Controllers;

use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    protected UserService $userService;

    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }

    public function index(Request $request): JsonResponse
    {
        $query = $request->query('q');
        $users = $this->userService->listUsers($query);

        return response()->json([
            'users' => $users,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'nullable|string|in:admin,user',
            'isActive' => 'nullable|boolean',
            'assignedProjectIds' => 'nullable|array',
            'assignedProjectIds.*' => 'string|exists:projects,id',
        ]);

        $user = $this->userService->createUser($validated);

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
            'password' => 'nullable|string|min:8',
            'role' => 'nullable|string|in:admin,user',
            'isActive' => 'nullable|boolean',
            'assignedProjectIds' => 'nullable|array',
            'assignedProjectIds.*' => 'string|exists:projects,id',
        ]);

        $user = $this->userService->updateUser($id, $validated);

        return response()->json([
            'user' => $user,
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            $this->userService->deleteUser($id);

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

        return response()->json([
            'assignedProjectIds' => $assignedProjectIds,
        ]);
    }
}
