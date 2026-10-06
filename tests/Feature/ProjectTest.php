<?php

namespace Tests\Feature;

use App\Models\BimModel;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $normalUser;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('models');

        $this->admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.local',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->normalUser = User::create([
            'name' => 'Normal User',
            'email' => 'user@test.local',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'is_active' => true,
        ]);
    }

    public function test_unauthenticated_request_to_projects_is_rejected(): void
    {
        $response = $this->getJson('/api/projects');

        $response->assertStatus(401)
            ->assertJson([
                'error' => 'Autenticación requerida. Inicie sesión.',
            ]);
    }

    public function test_normal_user_only_sees_assigned_projects(): void
    {
        $project1 = Project::create(['name' => 'Proyecto Asignado']);
        $project2 = Project::create(['name' => 'Proyecto Oculto']);

        // Assign only project1 to normalUser
        $this->normalUser->projects()->attach($project1->id, ['assigned_at' => now()->timestamp]);

        $response = $this->actingAs($this->normalUser)->getJson('/api/projects');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'projects']);

        $projects = $response->json('projects');
        $this->assertCount(1, $projects);
        $this->assertEquals($project1->id, $projects[0]['id']);
    }

    public function test_normal_user_cannot_access_unassigned_project_detail(): void
    {
        $unassignedProject = Project::create(['name' => 'Proyecto Confidencial']);

        $response = $this->actingAs($this->normalUser)->getJson("/api/projects/{$unassignedProject->id}");

        $response->assertStatus(403)
            ->assertJson([
                'error' => 'Acceso denegado. No tiene permisos para consultar este proyecto.',
            ]);
    }

    public function test_normal_user_can_access_assigned_project_detail(): void
    {
        $assignedProject = Project::create([
            'name' => 'Hospital Central',
            'description' => 'Plano estructural de hospital',
        ]);

        $this->normalUser->projects()->attach($assignedProject->id, ['assigned_at' => now()->timestamp]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/projects/{$assignedProject->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'project' => [
                    'id' => $assignedProject->id,
                    'name' => 'Hospital Central',
                    'description' => 'Plano estructural de hospital',
                ],
            ]);
    }

    public function test_admin_can_see_all_projects_regardless_of_assignment(): void
    {
        Project::create(['name' => 'Proyecto 1']);
        Project::create(['name' => 'Proyecto 2']);

        $response = $this->actingAs($this->admin)->getJson('/api/projects');

        $response->assertStatus(200);
        $this->assertCount(2, $response->json('projects'));
    }

    public function test_admin_can_create_project_and_initializes_storage(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/projects', [
            'name' => 'Nuevo Rascacielos',
            'description' => 'Diseño arquitectónico Torre A',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'status' => 'ok',
                'project' => [
                    'name' => 'Nuevo Rascacielos',
                    'description' => 'Diseño arquitectónico Torre A',
                ],
            ]);

        $projectId = $response->json('project.id');
        $this->assertDatabaseHas('projects', ['id' => $projectId, 'name' => 'Nuevo Rascacielos']);
        Storage::disk('models')->assertExists($projectId);
    }

    public function test_normal_user_cannot_create_project(): void
    {
        $response = $this->actingAs($this->normalUser)->postJson('/api/projects', [
            'name' => 'Proyecto No Permitido',
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_update_project(): void
    {
        $project = Project::create(['name' => 'Nombre Antiguo', 'description' => 'Desc']);

        $response = $this->actingAs($this->admin)->putJson("/api/projects/{$project->id}", [
            'name' => 'Nombre Actualizado',
            'description' => 'Descripción nueva',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'project' => [
                    'name' => 'Nombre Actualizado',
                    'description' => 'Descripción nueva',
                ],
            ]);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'name' => 'Nombre Actualizado',
        ]);
    }

    public function test_admin_can_delete_project_cascades_models_and_storage(): void
    {
        $project = Project::create(['name' => 'Proyecto a Eliminar']);
        Storage::disk('models')->makeDirectory($project->id);
        Storage::disk('models')->put("{$project->id}/sample.frag", 'binary content');

        BimModel::create([
            'project_id' => $project->id,
            'name' => 'sample.frag',
            'storage_path' => "{$project->id}/sample.frag",
            'size_bytes' => 14,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/projects/{$project->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'deletedModelsCount' => 1,
            ]);

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
        $this->assertDatabaseMissing('bim_models', ['project_id' => $project->id]);
        Storage::disk('models')->assertMissing("{$project->id}/sample.frag");
    }

    public function test_search_query_filters_projects(): void
    {
        Project::create(['name' => 'Puente Metropolitano']);
        Project::create(['name' => 'Edificio Residencial']);

        $response = $this->actingAs($this->admin)->getJson('/api/projects?q=puente');

        $response->assertStatus(200);
        $projects = $response->json('projects');
        $this->assertCount(1, $projects);
        $this->assertEquals('Puente Metropolitano', $projects[0]['name']);
    }
}
