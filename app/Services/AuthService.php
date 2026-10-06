<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Maximum failed login attempts allowed per window.
     */
    private const MAX_ATTEMPTS = 5;

    /**
     * Lockout window in seconds (15 minutes).
     */
    private const WINDOW_SECONDS = 900;

    public function login(string $email, string $password, string $ip): array
    {
        $cleanEmail = strtolower(trim($email));

        // 1. Check brute force rate limiting
        $cutoff = now()->subSeconds(self::WINDOW_SECONDS);
        $attemptsCount = DB::table('login_attempts')
            ->where('ip', $ip)
            ->where('attempt_time', '>=', $cutoff)
            ->count();

        if ($attemptsCount >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages([
                'email' => ['Demasiados intentos fallidos. Intente nuevamente en 15 minutos.'],
            ])->status(429);
        }

        // 2. Lookup user
        $user = User::where('email', $cleanEmail)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            // Record failed attempt
            DB::table('login_attempts')->insert([
                'ip' => $ip,
                'email' => $cleanEmail,
                'attempt_time' => now(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Credenciales no válidas.'],
            ])->status(401);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Su cuenta se encuentra inactiva. Contacte al administrador.'],
            ])->status(403);
        }

        // 3. Clear failed attempts on successful login
        DB::table('login_attempts')
            ->where('ip', $ip)
            ->where('email', $cleanEmail)
            ->delete();

        // 4. Authenticate session
        Auth::login($user, remember: true);
        request()->session()->regenerate();

        return $this->formatUserSummary($user);
    }

    public function logout(): void
    {
        Auth::logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();
    }

    public function getCurrentUser(): ?array
    {
        $user = Auth::user();

        if (! $user) {
            return null;
        }

        return $this->formatUserSummary($user);
    }

    public function formatUserSummary(User $user): array
    {
        $assignedProjectIds = $user->isAdmin()
            ? \App\Models\Project::pluck('id')->all()
            : $user->projects()->pluck('projects.id')->all();

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'isActive' => (bool) $user->is_active,
            'assignedProjectIds' => $assignedProjectIds,
            'assignedProjectsCount' => count($assignedProjectIds),
            'createdAt' => $user->created_at ? $user->created_at->getTimestampMs() : now()->getTimestampMs(),
            'updatedAt' => $user->updated_at ? $user->updated_at->getTimestampMs() : now()->getTimestampMs(),
        ];
    }
}
