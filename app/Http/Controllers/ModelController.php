<?php

namespace App\Http\Controllers;

use App\Services\ModelService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ModelController extends Controller
{
    protected ModelService $modelService;

    public function __construct(ModelService $modelService)
    {
        $this->modelService = $modelService;
    }

    /**
     * Display a listing of models accessible to the user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = $request->query('q');
        $projectId = $request->query('projectId');
        $status = $request->query('status');

        try {
            $models = $this->modelService->listModels($q, $projectId, $status, $user);

            return response()->json([
                'status' => 'ok',
                'models' => $models,
            ]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        }
    }

    /**
     * Display the specified model detail.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        try {
            $model = $this->modelService->getModelDetail($id, $user);

            return response()->json([
                'status' => 'ok',
                'model' => $model,
            ]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Modelo con ID {$id} no encontrado.",
            ], 404);
        }
    }

    /**
     * Directly upload a pre-converted .frag file without conversion (Admin only).
     */
    public function uploadFrag(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'file' => 'required|file|max:524288', // Max 512 MB
        ]);

        try {
            $file = $request->file('file');
            $model = $this->modelService->uploadDirectFrag($id, $file, $user);

            return response()->json([
                'status' => 'ok',
                'message' => "Modelo {$model['name']} subido y registrado exitosamente sin conversión.",
                'model' => $model,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 400);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Proyecto con ID {$id} no encontrado.",
            ], 404);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        }
    }

    /**
     * Stream binary download of .frag file.
     */
    public function download(Request $request, string $id): Response
    {
        $user = $request->user();

        try {
            return $this->modelService->downloadModelFile($id, $user);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Remove the specified model from database and storage (Admin only).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        try {
            $result = $this->modelService->deleteModel($id, $user);

            return response()->json($result);
        } catch (AccessDeniedHttpException $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'error' => "Modelo con ID {$id} no encontrado.",
            ], 404);
        }
    }
}
