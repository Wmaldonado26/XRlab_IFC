<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ModelController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
        'app' => config('app.name'),
    ]);
});

// Authentication routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// Authenticated Project and Model routes (Row-level permission aware)
Route::middleware(['auth.ifc'])->group(function () {
    // Projects
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);

    // Models
    Route::get('/models', [ModelController::class, 'index']);
    Route::get('/models/{id}', [ModelController::class, 'show']);
    Route::get('/models/{id}/download', [ModelController::class, 'download']);

    // Heavy Processing IFC -> FRAG Conversions
    Route::post('/convert', [\App\Http\Controllers\ConversionController::class, 'convert']);
    Route::get('/jobs/{id}/progress', [\App\Http\Controllers\ConversionController::class, 'progress']);
    Route::get('/jobs/{id}/status', [\App\Http\Controllers\ConversionController::class, 'status']);
    Route::get('/jobs/{id}/download/{part}', [\App\Http\Controllers\ConversionController::class, 'download']);
});

// Admin Only routes
Route::middleware(['auth.ifc', 'admin.ifc'])->group(function () {
    // User management
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::match(['put', 'patch'], '/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::get('/users/{id}/projects', [UserController::class, 'projects']);
    Route::put('/users/{id}/projects', [UserController::class, 'updateProjects']);

    // Project management
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::match(['put', 'patch'], '/projects/{id}', [ProjectController::class, 'update']);
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);

    // Direct Model upload and delete (Admin only)
    Route::post('/projects/{id}/models/upload-frag', [ModelController::class, 'uploadFrag']);
    Route::delete('/models/{id}', [ModelController::class, 'destroy']);
});

