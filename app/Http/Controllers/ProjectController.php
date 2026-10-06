<?php

namespace App\Http\Controllers;

use App\Services\ProjectService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ProjectController extends Controller
{
    protected ProjectService $projectService;

    public function __construct(ProjectService $projectService)
    {
        $this->projectService = $projectService;
    }

    /**
     * Display a listing of projects accessible to the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $request->query('q');

        $projects = $this->projectService->listProjects($query, $user);

        return response()->json([
            'status' => 'ok',
            'projects' => $projects,
        ]);
    }

    /**
     * Store a newly created project (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $project = $this->projectService->createProject($validated);

        return response()->json([
            'status' => 'ok',
            'project' => $project,
        ], 201);
    }

    /**
     * Display the specified project with its models and parts.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        try {
            $project = $this->projectService->getProject($id, $user);

            return response()->json([
                'status' => 'ok',
                'project' => $project,
            ]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Proyecto con ID {$id} no encontrado.",
            ], 404);
        }
    }

    /**
     * Update the specified project (Admin only).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        try {
            $project = $this->projectService->updateProject($id, $validated);

            return response()->json([
                'status' => 'ok',
                'project' => $project,
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Proyecto con ID {$id} no encontrado.",
            ], 404);
        }
    }

    /**
     * Remove the specified project and its models (Admin only).
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $result = $this->projectService->deleteProject($id);

            return response()->json($result);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Proyecto con ID {$id} no encontrado.",
            ], 404);
        }
    }
}
