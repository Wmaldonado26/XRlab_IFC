<?php

namespace Tests\Feature;

use App\Models\BimModel;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ModelTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $normalUser;
    protected Project $assignedProject;
    protected Project $unassignedProject;

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

        $this->assignedProject = Project::create(['name' => 'Proyecto Permitido']);
        $this->unassignedProject = Project::create(['name' => 'Proyecto Restringido']);

        $this->normalUser->projects()->attach($this->assignedProject->id, ['assigned_at' => now()->timestamp]);
    }

    public function test_unauthenticated_request_to_models_is_rejected(): void
    {
        $response = $this->getJson('/api/models');

        $response->assertStatus(401);
    }

    public function test_normal_user_only_sees_models_of_assigned_projects(): void
    {
        $model1 = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'permitido.frag',
            'storage_path' => "{$this->assignedProject->id}/permitido.frag",
            'size_bytes' => 1024,
            'status' => 'ready',
        ]);

        $model2 = BimModel::create([
            'project_id' => $this->unassignedProject->id,
            'name' => 'restringido.frag',
            'storage_path' => "{$this->unassignedProject->id}/restringido.frag",
            'size_bytes' => 2048,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->getJson('/api/models');

        $response->assertStatus(200)
            ->assertJsonStructure(['status', 'models']);

        $models = $response->json('models');
        $this->assertCount(1, $models);
        $this->assertEquals($model1->id, $models[0]['id']);
    }

    public function test_normal_user_cannot_view_unassigned_model_detail(): void
    {
        $model = BimModel::create([
            'project_id' => $this->unassignedProject->id,
            'name' => 'confidencial.frag',
            'storage_path' => "{$this->unassignedProject->id}/confidencial.frag",
            'size_bytes' => 1024,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/models/{$model->id}");

        $response->assertStatus(403);
    }

    public function test_normal_user_can_view_assigned_model_detail(): void
    {
        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'estructura.frag',
            'storage_path' => "{$this->assignedProject->id}/estructura.frag",
            'size_bytes' => 4096,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/models/{$model->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'model' => [
                    'id' => $model->id,
                    'name' => 'estructura.frag',
                    'projectId' => $this->assignedProject->id,
                ],
            ]);
    }

    public function test_normal_user_cannot_download_unassigned_model(): void
    {
        $model = BimModel::create([
            'project_id' => $this->unassignedProject->id,
            'name' => 'secreto.frag',
            'storage_path' => "{$this->unassignedProject->id}/secreto.frag",
            'size_bytes' => 100,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/models/{$model->id}/download");

        $response->assertStatus(403);
    }

    public function test_normal_user_can_download_assigned_model(): void
    {
        $content = 'BINARY_FRAG_SAMPLE_CONTENT';
        Storage::disk('models')->put("{$this->assignedProject->id}/edificio.frag", $content);

        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'edificio.frag',
            'storage_path' => "{$this->assignedProject->id}/edificio.frag",
            'size_bytes' => strlen($content),
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->get("/api/models/{$model->id}/download");

        $response->assertStatus(200);
        $this->assertEquals($content, $response->streamedContent());
    }

    public function test_admin_can_upload_direct_frag(): void
    {
        $fakeFrag = UploadedFile::fake()->create('modulo_a.frag', 500, 'application/octet-stream');

        $response = $this->actingAs($this->admin)->postJson(
            "/api/projects/{$this->assignedProject->id}/models/upload-frag",
            ['file' => $fakeFrag]
        );

        $response->assertStatus(201)
            ->assertJson([
                'status' => 'ok',
                'model' => [
                    'name' => 'modulo_a.frag',
                    'projectId' => $this->assignedProject->id,
                    'status' => 'ready',
                ],
            ]);

        $modelId = $response->json('model.id');
        $this->assertDatabaseHas('bim_models', [
            'id' => $modelId,
            'project_id' => $this->assignedProject->id,
            'name' => 'modulo_a.frag',
        ]);

        Storage::disk('models')->assertExists("{$this->assignedProject->id}/modulo_a.frag");
    }

    public function test_admin_can_upload_large_150mb_frag_file(): void
    {
        // 148 MB = 151552 KB
        $largeFrag = UploadedFile::fake()->create('modelo-2.frag', 151552, 'application/octet-stream');

        $response = $this->actingAs($this->admin)->postJson(
            "/api/projects/{$this->assignedProject->id}/models/upload-frag",
            ['file' => $largeFrag]
        );

        $response->assertStatus(201)
            ->assertJson([
                'status' => 'ok',
                'model' => [
                    'name' => 'modelo-2.frag',
                    'projectId' => $this->assignedProject->id,
                    'status' => 'ready',
                ],
            ]);

        $modelId = $response->json('model.id');
        $this->assertDatabaseHas('bim_models', [
            'id' => $modelId,
            'project_id' => $this->assignedProject->id,
            'name' => 'modelo-2.frag',
        ]);

        Storage::disk('models')->assertExists("{$this->assignedProject->id}/modelo-2.frag");
    }

    public function test_upload_rejects_non_frag_file(): void
    {
        $fakePdf = UploadedFile::fake()->create('documento.pdf', 50, 'application/pdf');

        $response = $this->actingAs($this->admin)->postJson(
            "/api/projects/{$this->assignedProject->id}/models/upload-frag",
            ['file' => $fakePdf]
        );

        $response->assertStatus(400)
            ->assertJson([
                'error' => 'Solo se admiten archivos con extensión .frag.',
            ]);
    }

    public function test_admin_can_delete_model(): void
    {
        Storage::disk('models')->put("{$this->assignedProject->id}/antiguo.frag", 'test');

        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'antiguo.frag',
            'storage_path' => "{$this->assignedProject->id}/antiguo.frag",
            'size_bytes' => 4,
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/models/{$model->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'modelName' => 'antiguo.frag',
            ]);

        $this->assertDatabaseMissing('bim_models', ['id' => $model->id]);
        Storage::disk('models')->assertMissing("{$this->assignedProject->id}/antiguo.frag");
    }

    public function test_normal_user_cannot_upload_or_delete_model(): void
    {
        $fakeFrag = UploadedFile::fake()->create('test.frag', 10, 'application/octet-stream');

        // Attempt upload
        $uploadRes = $this->actingAs($this->normalUser)->postJson(
            "/api/projects/{$this->assignedProject->id}/models/upload-frag",
            ['file' => $fakeFrag]
        );
        $uploadRes->assertStatus(403);

        // Attempt delete
        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'test.frag',
            'storage_path' => "{$this->assignedProject->id}/test.frag",
            'size_bytes' => 10,
            'status' => 'ready',
        ]);

        $delRes = $this->actingAs($this->normalUser)->deleteJson("/api/models/{$model->id}");
        $delRes->assertStatus(403);
    }

    public function test_user_can_download_project_model_by_filename(): void
    {
        $content = 'BINARY_DATA_FRAG_SAMPLE';
        Storage::disk('models')->put("{$this->assignedProject->id}/modelo-2.frag", $content);

        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'modelo-2.frag',
            'storage_path' => "{$this->assignedProject->id}/modelo-2.frag",
            'size_bytes' => strlen($content),
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->get(
            "/api/projects/{$this->assignedProject->id}/models/modelo-2.frag/download"
        );

        $response->assertStatus(200);
        $this->assertEquals($content, $response->streamedContent());
    }

    public function test_user_can_download_project_model_by_canonical_uuid(): void
    {
        $content = 'BINARY_DATA_FRAG_UUID_SAMPLE';
        Storage::disk('models')->put("{$this->assignedProject->id}/modelo-2.frag", $content);

        $model = BimModel::create([
            'project_id' => $this->assignedProject->id,
            'name' => 'modelo-2.frag',
            'storage_path' => "{$this->assignedProject->id}/modelo-2.frag",
            'size_bytes' => strlen($content),
            'status' => 'ready',
        ]);

        $response = $this->actingAs($this->normalUser)->get(
            "/api/projects/{$this->assignedProject->id}/models/{$model->id}/download"
        );

        $response->assertStatus(200);
        $this->assertEquals($content, $response->streamedContent());
    }

    public function test_project_model_download_rejects_model_from_different_project(): void
    {
        $content = 'CROSS_PROJECT_CONTENT';
        Storage::disk('models')->put("{$this->unassignedProject->id}/otro.frag", $content);

        $model = BimModel::create([
            'project_id' => $this->unassignedProject->id,
            'name' => 'otro.frag',
            'storage_path' => "{$this->unassignedProject->id}/otro.frag",
            'size_bytes' => strlen($content),
            'status' => 'ready',
        ]);

        // Attempting to request model of unassignedProject through assignedProject
        $response = $this->actingAs($this->normalUser)->get(
            "/api/projects/{$this->assignedProject->id}/models/otro.frag/download"
        );

        $response->assertStatus(404);
    }
}
