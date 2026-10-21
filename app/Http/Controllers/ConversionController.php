<?php

namespace App\Http\Controllers;

use App\Services\ChunkUploadService;
use App\Services\ConversionService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ConversionController extends Controller
{
    protected ConversionService $conversionService;
    protected ChunkUploadService $chunkUploadService;

    public function __construct(ConversionService $conversionService, ChunkUploadService $chunkUploadService)
    {
        $this->conversionService = $conversionService;
        $this->chunkUploadService = $chunkUploadService;
    }

    /**
     * Upload an IFC file directly to initiate conversion (standard endpoint).
     */
    public function convert(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'file' => 'required|file|max:15360',
        ]);

        $projectId = $request->input('projectId') ?: $request->query('projectId');

        try {
            $file = $request->file('file');
            $jobData = $this->conversionService->createJob($file, $projectId, $user);

            return response()->json($jobData, 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Initiates a chunked upload session for large IFC files (> 100 MB or multi-GB).
     */
    public function initUpload(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'fileName' => 'required|string',
            'totalBytes' => 'required|integer|min:1|max:1879048192',
            'totalChunks' => 'required|integer|min:1|max:120',
            'chunkSize' => 'required|integer|min:1|max:15728640',
            'projectId' => 'nullable|string',
        ]);

        try {
            $data = $this->chunkUploadService->initUpload(
                $request->input('fileName'),
                (int) $request->input('totalBytes'),
                (int) $request->input('totalChunks'),
                (int) $request->input('chunkSize'),
                $request->input('projectId'),
                $user
            );

            return response()->json($data, 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Uploads an individual chunk of a chunked upload session.
     */
    public function chunkUpload(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'uploadId' => 'required|string|max:64',
            'chunkIndex' => 'required|integer|min:0',
            'file' => 'required|file',
        ]);

        try {
            $uploadId = $request->input('uploadId');
            $chunkIndex = (int) $request->input('chunkIndex');
            $chunkFile = $request->file('file');

            $res = $this->chunkUploadService->saveChunk($uploadId, $chunkIndex, $chunkFile, $user);

            return response()->json($res);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Retrieves chunked upload progress, allowing client to resume interrupted uploads.
     */
    public function uploadStatus(Request $request, string $uploadId): JsonResponse
    {
        $user = $request->user();

        try {
            $status = $this->chunkUploadService->getUploadStatus($uploadId, $user);
            return response()->json($status);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Completes chunked upload, verifies integrity, saves intact IFC, and starts conversion job.
     */
    public function completeUpload(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'uploadId' => 'required|string',
        ]);

        try {
            $uploadId = $request->input('uploadId');
            $assembledData = $this->chunkUploadService->completeUpload($uploadId, $user);

            // Create conversion job with intact original IFC
            $jobData = $this->conversionService->createJobFromAssembledIfc(
                $assembledData['intactIfcPath'],
                $assembledData['fileName'],
                $assembledData['projectId'],
                $user
            );

            return response()->json($jobData, 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            Log::error('Chunked IFC upload completion failed.', [
                'exception' => $e,
                'upload_id' => $uploadId,
            ]);

            return response()->json([
                'error' => 'No se pudo completar la carga. Intente nuevamente o contacte al administrador.',
            ], 500);
        }
    }

    /**
     * Cancels chunked upload and cleans up temporary chunks.
     */
    public function cancelUpload(Request $request, string $uploadId): JsonResponse
    {
        $user = $request->user();

        try {
            $cancelled = $this->chunkUploadService->cancelUpload($uploadId, $user);
            return response()->json(['cancelled' => $cancelled]);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        }
    }

    /**
     * Server-Sent Events (SSE) streaming endpoint for live conversion progress.
     */
    public function progress(Request $request, string $id): Response
    {
        $user = $request->user();

        try {
            return $this->conversionService->streamProgress($id, $user);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Retrieve job status by ID.
     */
    public function status(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        try {
            $status = $this->conversionService->getJobStatus($id, $user);

            return response()->json($status);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }

    /**
     * Download fragment part generated by a job.
     */
    public function download(Request $request, string $id, string $part): Response
    {
        $user = $request->user();

        try {
            return $this->conversionService->downloadJobPart($id, $part, $user);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['error' => $e->getMessage()], 403);
        } catch (ModelNotFoundException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }
    }
}
