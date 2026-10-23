<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure an admin user exists for tests
        User::firstOrCreate(
            ['email' => 'admin@ifcxrlab.local'],
            [
                'name' => 'Administrador Principal',
                'password' => Hash::make('Admin2026!*'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );
    }

    public function test_admin_can_login_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@ifcxrlab.local',
            'password' => 'Admin2026!*',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'user' => [
                    'email' => 'admin@ifcxrlab.local',
                    'role' => 'admin',
                    'isActive' => true,
                ],
            ]);

        $this->assertAuthenticated();
    }

    public function test_login_fails_with_invalid_credentials_without_leaking_user_existence(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@ifcxrlab.local',
            'password' => 'WrongPassword123!',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error' => 'Credenciales no válidas.',
            ]);

        $this->assertGuest();
    }

    public function test_password_reset_request_does_not_reveal_if_email_exists(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'reset-user@example.test']);

        $knownEmail = $this->postJson('/api/auth/forgot-password', [
            'email' => $user->email,
        ]);
        $unknownEmail = $this->postJson('/api/auth/forgot-password', [
            'email' => 'unknown@example.test',
        ]);

        $knownEmail->assertOk()->assertJsonPath('success', true);
        $unknownEmail->assertOk()->assertExactJson($knownEmail->json());
        Notification::assertSentTo($user, ResetPasswordNotification::class);

        $notification = Notification::sent($user, ResetPasswordNotification::class)->first();
        $this->assertStringContainsString('#reset-password?token=', $notification->toMail($user)->actionUrl);
    }

    public function test_user_can_reset_password_with_valid_token(): void
    {
        $user = User::factory()->create(['email' => 'reset-user@example.test']);
        $token = Password::createToken($user);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'NewSecurePassword2026!',
            'password_confirmation' => 'NewSecurePassword2026!',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertTrue(Hash::check('NewSecurePassword2026!', $user->fresh()->password));
    }

    public function test_password_reset_rejects_invalid_token(): void
    {
        $user = User::factory()->create(['email' => 'reset-user@example.test']);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => 'invalid-token',
            'password' => 'NewSecurePassword2026!',
            'password_confirmation' => 'NewSecurePassword2026!',
        ]);

        $response->assertUnprocessable()->assertJsonPath('success', false);
        $this->assertFalse(Hash::check('NewSecurePassword2026!', $user->fresh()->password));
    }

    public function test_me_endpoint_returns_authenticated_user(): void
    {
        $admin = User::where('email', 'admin@ifcxrlab.local')->first();

        $response = $this->actingAs($admin)->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'authenticated' => true,
                'user' => [
                    'email' => 'admin@ifcxrlab.local',
                    'role' => 'admin',
                ],
            ]);
    }

    public function test_user_can_logout(): void
    {
        $admin = User::where('email', 'admin@ifcxrlab.local')->first();

        $response = $this->actingAs($admin)->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertGuest();
    }

    public function test_unauthenticated_request_to_users_endpoint_is_rejected(): void
    {
        $response = $this->getJson('/api/users');

        $response->assertStatus(401);
    }

    public function test_regular_user_cannot_access_admin_users_endpoint(): void
    {
        $user = User::factory()->create([
            'role' => 'user',
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/users');

        $response->assertStatus(403);
    }

    public function test_admin_can_manage_users(): void
    {
        $admin = User::where('email', 'admin@ifcxrlab.local')->first();

        // 1. Create new user
        $createResponse = $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'Operador BIM',
            'email' => 'operador@ifcxrlab.local',
            'password' => 'PasswordSegura123!',
            'role' => 'user',
            'isActive' => true,
        ]);

        $createResponse->assertStatus(201)
            ->assertJson([
                'user' => [
                    'email' => 'operador@ifcxrlab.local',
                    'role' => 'user',
                ],
            ]);

        $newUserId = $createResponse->json('user.id');

        // 2. List users
        $listResponse = $this->actingAs($admin)->getJson('/api/users');
        $listResponse->assertStatus(200);

        // 3. Delete created user
        $deleteResponse = $this->actingAs($admin)->deleteJson("/api/users/{$newUserId}");
        $deleteResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_admin_can_filter_and_paginate_users(): void
    {
        User::factory()->count(30)->sequence(fn ($sequence) => [
            'role' => $sequence->index % 2 === 0 ? 'user' : 'admin',
            'is_active' => $sequence->index % 3 !== 0,
        ])->create();

        $admin = User::where('email', 'admin@ifcxrlab.local')->first();
        $response = $this->actingAs($admin)->getJson('/api/users?page=2&per_page=3&role=user&status=active');

        $response->assertOk()
            ->assertJsonCount(3, 'users')
            ->assertJsonPath('pagination.currentPage', 2)
            ->assertJsonPath('pagination.lastPage', 4)
            ->assertJsonPath('pagination.perPage', 3)
            ->assertJsonPath('pagination.total', 10);
    }
}
