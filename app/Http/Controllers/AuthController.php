<?php

namespace App\Http\Controllers;

use App\Services\AuthService;
use App\Services\ActivityLogger;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    protected AuthService $authService;
    protected ActivityLogger $activityLogger;

    public function __construct(AuthService $authService, ActivityLogger $activityLogger)
    {
        $this->authService = $authService;
        $this->activityLogger = $activityLogger;
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'remember' => 'sometimes|boolean',
        ]);

        try {
            $user = $this->authService->login(
                $validated['email'],
                $validated['password'],
                $request->ip() ?? '127.0.0.1',
                (bool) ($validated['remember'] ?? false)
            );
            $actor = User::find($user['id'] ?? null);
            $this->activityLogger->record('Inicio de sesión', 'session', null, 'Acceso autenticado', null, [], $actor);

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

    public function logout(Request $request): JsonResponse
    {
        if ($request->user()) {
            $this->activityLogger->record('Cierre de sesión', 'session', null, 'Sesión autenticada', null, [], $request->user());
        }
        $this->authService->logout();

        return response()->json([
            'success' => true,
            'csrfToken' => csrf_token(),
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

    public function sendPasswordResetLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        try {
            Password::sendResetLink([
                'email' => strtolower(trim($validated['email'])),
            ]);
        } catch (\Throwable $exception) {
            Log::error('No se pudo procesar el correo de recuperaciÃ³n de contraseÃ±a.', [
                'exception' => $exception::class,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Si el correo corresponde a una cuenta, recibirÃ¡ instrucciones para restablecer la contraseÃ±a.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'confirmed', PasswordRule::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $status = Password::reset([
            'email' => strtolower(trim($validated['email'])),
            'password' => $validated['password'],
            'password_confirmation' => $request->input('password_confirmation'),
            'token' => $validated['token'],
        ], function (User $user) use ($validated): void {
            $user->forceFill([
                'password' => Hash::make($validated['password']),
                'remember_token' => Str::random(60),
            ])->save();

            if (config('session.driver') === 'database') {
                DB::table(config('session.table', 'sessions'))
                    ->where('user_id', $user->id)
                    ->delete();
            }

            if ((string) Auth::id() === (string) $user->id) {
                Auth::logout();
                request()->session()->invalidate();
                request()->session()->regenerateToken();
            }

            event(new PasswordReset($user));
        });

        if ($status === Password::PASSWORD_RESET) {
            $resetUser = User::where('email', strtolower(trim($validated['email'])))->first();
            $this->activityLogger->record('Contraseña restablecida', 'user', $resetUser?->id, $resetUser?->name, null, [], $resetUser);
            return response()->json([
                'success' => true,
                'message' => 'La contraseÃ±a se restableciÃ³. Ya puedes iniciar sesiÃ³n.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'El enlace no es vÃ¡lido o expirÃ³. Solicita uno nuevo.',
        ], 422);
    }
}
