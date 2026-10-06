<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_api_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
            ]);
    }

    public function test_spa_root_serves_app_blade(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200)
            ->assertSee('id="app"', false);
    }
}
