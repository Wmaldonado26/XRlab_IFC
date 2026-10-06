<?php

namespace App\Http\Controllers;

use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        try {
            $user = $this->authService->login(
                $validated['email'],
                $validated['password'],
                $request->ip() ?? '127.0.0.1'
            );

            return response()->json([
                'success' => true,
                'user' => $user,
            ]);
        } catch (ValidationException $e) {
            $status = $e->status ?? 401;
            $messages = $e->errors();
            $firstMessage = reset($messages)[0] ?? 'Fallo de autenticación.';

            return response()->json([
                'success' => false,
                'error' => $firstMessage,
            ], $status);
        }
    }

    public function logout(): JsonResponse
    {
        $this->authService->logout();

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente.',
        ]);
    }

    public function me(): JsonResponse
    {
        $user = $this->authService->getCurrentUser();

        return response()->json([
            'authenticated' => $user !== null,
            'user' => $user,
        ]);
    }
}
