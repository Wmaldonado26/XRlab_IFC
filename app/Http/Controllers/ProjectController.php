<?php

namespace App\Http\Controllers;

use App\Services\ProjectService;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ProjectController extends Controller
{
    protected ProjectService $projectService;
    protected ActivityLogger $activityLogger;

    public function __construct(ProjectService $projectService, ActivityLogger $activityLogger)
    {
        $this->projectService = $projectService;
        $this->activityLogger = $activityLogger;
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
            'image_url' => 'nullable|string|max:2048',
            'imageUrl' => 'nullable|string|max:2048',
            'cover' => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,svg|max:10240',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,svg|max:10240',
        ]);

        $project = $this->projectService->createProject($validated);

        $coverFile = $request->file('cover') ?? $request->file('image');
        if ($coverFile) {
            $project = $this->projectService->uploadCoverImage($project['id'], $coverFile, $request->user());
        }
        $this->activityLogger->record('Proyecto creado', 'project', $project['id'], $project['name'], (string) $project['id'], [], $request->user());

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
            'image_url' => 'nullable|string|max:2048',
            'imageUrl' => 'nullable|string|max:2048',
        ]);

        try {
            $project = $this->projectService->updateProject($id, $validated);
            $this->activityLogger->record('Proyecto actualizado', 'project', $id, $project['name'], $id, ['fields' => array_keys(array_filter($validated, fn ($value) => $value !== null))], $request->user());

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
     * Upload or update project cover image (Admin only).
     */
    public function uploadCover(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'cover' => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,svg|max:10240',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,svg|max:10240',
        ]);

        $file = $request->file('cover') ?? $request->file('image');
        if (! $file) {
            return response()->json(['error' => 'No se adjuntÃ³ archivo de imagen.'], 422);
        }

        try {
            $project = $this->projectService->uploadCoverImage($id, $file, $request->user());
            $this->activityLogger->record('Portada actualizada', 'project', $id, $project['name'], $id, [], $request->user());

            return response()->json([
                'status' => 'ok',
                'message' => 'Imagen de portada actualizada con Ã©xito.',
                'project' => $project,
            ]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => "Proyecto con ID {$id} no encontrado."], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Delete project cover image (Admin only).
     */
    public function deleteCover(Request $request, string $id): JsonResponse
    {
        try {
            $project = $this->projectService->deleteCoverImage($id, $request->user());
            $this->activityLogger->record('Portada eliminada', 'project', $id, $project['name'], $id, [], $request->user());

            return response()->json([
                'status' => 'ok',
                'message' => 'Imagen de portada eliminada con Ã©xito.',
                'project' => $project,
            ]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => "Proyecto con ID {$id} no encontrado."], 404);
        }
    }

    /**
     * Stream binary download/display of project cover image.
     */
    public function getCover(Request $request, string $id): Response
    {
        $user = $request->user();
        if ($user && ! $user->hasAccessToProject($id)) {
            return response()->json(['error' => 'Acceso denegado.'], 403);
        }

        try {
            return $this->projectService->getCoverImageFile($id);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => 'Portada no disponible.'], 404);
        }
    }

    /**
     * Remove the specified project and its models (Admin only).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        try {
            $project = \App\Models\Project::findOrFail($id);
            $result = $this->projectService->deleteProject($id);
            $this->activityLogger->record('Proyecto eliminado', 'project', $id, $project->name, $id, [], $request->user());

            return response()->json($result);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Proyecto con ID {$id} no encontrado.",
            ], 404);
        }
    }

    /**
     * Operational statistics for COTECMAR XRlab Dashboard (permission-aware).
     */
    public function dashboardStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $projectQuery = \App\Models\Project::query();
        $modelQuery = \App\Models\BimModel::query();

        if (! $isAdmin) {
            $assignedIds = $user->projects()->pluck('projects.id');
            $projectQuery->whereIn('id', $assignedIds);
            $modelQuery->whereIn('project_id', $assignedIds);
        }

        $projectsCount = $projectQuery->count();
        $modelsCount = $modelQuery->count();
        $usersCount = $isAdmin ? \App\Models\User::count() : 1;
        $totalBytes = (int) $modelQuery->sum('size_bytes');

        // Human readable bytes
        $storageFormatted = '0 B';
        if ($totalBytes > 0) {
            $units = ['B', 'KB', 'MB', 'GB', 'TB'];
            $i = (int) floor(log($totalBytes, 1024));
            $storageFormatted = round($totalBytes / pow(1024, $i), 2) . ' ' . ($units[$i] ?? 'B');
        }

        // Recent projects
        $recentProjects = $this->projectService->listProjects(null, $user);
        $recentProjectsSlice = array_slice($recentProjects, 0, 5);

        // Recent activity items (real events from DB)
        $activity = [];

        // Recent models
        $recentModels = \App\Models\BimModel::with('project')
            ->when(! $isAdmin, fn($q) => $q->whereIn('project_id', $user->projects()->pluck('projects.id')))
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        foreach ($recentModels as $rm) {
            $activity[] = [
                'id' => 'mdl_' . $rm->id,
                'type' => 'model',
                'action' => 'Modelo cargado',
                'resource' => $rm->name . ' (' . round($rm->size_bytes / (1024 * 1024), 1) . ' MB)',
                'projectName' => $rm->project ? $rm->project->name : 'General',
                'user' => 'COTECMAR XRlab',
                'result' => 'Exitoso',
                'statusClass' => 'ok',
                'date' => $rm->created_at ? $rm->created_at->format('d M Â· H:i') : 'Reciente',
                'timestamp' => $rm->created_at ? $rm->created_at->timestamp : 0,
            ];
        }

        // Recent conversion jobs
        $recentJobs = \App\Models\ConversionJob::query()->with(['project', 'user'])
            ->when(! $isAdmin, fn($q) => $q->where('user_id', $user->id))
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        foreach ($recentJobs as $rj) {
            $activity[] = [
                'id' => 'job_' . $rj->id,
                'type' => 'conversion',
                'action' => 'ConversiÃ³n IFC',
                'resource' => $rj->original_ifc_name,
                'projectName' => $rj->project ? $rj->project->name : 'ConversiÃ³n',
                'user' => $rj->user ? $rj->user->name : 'Usuario',
                'result' => $rj->status === 'completed' ? 'Exitoso' : ($rj->status === 'failed' ? 'Error' : 'Procesando'),
                'statusClass' => $rj->status === 'completed' ? 'ok' : ($rj->status === 'failed' ? 'err' : 'warn'),
                'date' => $rj->created_at ? $rj->created_at->format('d M Â· H:i') : 'Reciente',
                'timestamp' => $rj->created_at ? $rj->created_at->timestamp : 0,
            ];
        }

        // Sort all activity by timestamp desc
        usort($activity, fn($a, $b) => $b['timestamp'] <=> $a['timestamp']);

        return response()->json([
            'status' => 'ok',
            'stats' => [
                'activeProjects' => $projectsCount,
                'bimModels' => $modelsCount,
                'users' => $usersCount,
                'storageBytes' => $totalBytes,
                'storageFormatted' => $storageFormatted,
                'recentProjects' => $recentProjectsSlice,
                'recentActivity' => array_slice($activity, 0, 10),
            ],
        ]);
    }

    /**
     * Audit and activity logs for XRlab platform.
     */
    public function activityLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate(['page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1|max:100']);
        $query = \App\Models\ActivityLog::query();
        if (! $user->isAdmin()) {
            $projectIds = $user->projects()->pluck('projects.id')->map(fn ($id) => (string) $id)->all();
            $query->where(function ($scope) use ($user, $projectIds) {
                $scope->where('user_id', $user->id);
                if ($projectIds) $scope->orWhereIn('project_id', $projectIds);
            });
        }
        $page = $query->orderByDesc('created_at')->orderByDesc('id')->paginate((int) ($validated['per_page'] ?? 25));
        $page->getCollection()->transform(fn ($log) => [
            'id' => (string) $log->id,
            'date' => $log->created_at?->format('d M Â· H:i') ?? 'â€”',
            'user' => $log->actor_name ?? 'Usuario eliminado',
            'action' => $log->action,
            'resource' => $log->resource_name ?? $log->resource_type,
            'projectName' => $log->project_name,
            'result' => $log->result === 'success' ? 'Exitoso' : 'Error',
            'statusClass' => $log->result === 'success' ? 'ok' : 'err',
            'timestamp' => $log->created_at?->timestamp ?? 0,
        ]);

        return response()->json([
            'status' => 'ok',
            'logs' => $page->items(),
            'pagination' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }
}

