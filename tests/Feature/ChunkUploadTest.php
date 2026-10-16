<?php

namespace Tests\Feature;

use App\Jobs\ConvertIfcJob;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChunkUploadTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $normalUser;
    protected Project $userProject;

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

        $this->userProject = Project::create(['name' => 'Proyecto Test Chunks']);
        $this->normalUser->projects()->attach($this->userProject->id, ['assigned_at' => now()->timestamp]);
    }

    public function test_init_upload_requires_authentication(): void
    {
        $response = $this->postJson('/api/upload/init', [
            'fileName' => 'model.ifc',
            'totalBytes' => 1024,
            'totalChunks' => 2,
            'chunkSize' => 512,
        ]);

        $response->assertStatus(401);
    }

    public function test_init_upload_validates_ifc_extension(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/upload/init', [
            'fileName' => 'malicious.exe',
            'totalBytes' => 1024,
            'totalChunks' => 2,
            'chunkSize' => 512,
        ]);

        $response->assertStatus(400)
            ->assertJson(['error' => 'Solo se admiten archivos con formato IFC (.ifc).']);
    }

    public function test_init_upload_prevents_unauthorized_project_access(): void
    {
        $otherProject = Project::create(['name' => 'Proyecto Inaccesible']);

        $response = $this->actingAs($this->normalUser)->postJson('/api/upload/init', [
            'fileName' => 'edificio.ifc',
            'totalBytes' => 2048,
            'totalChunks' => 2,
            'chunkSize' => 1024,
            'projectId' => $otherProject->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_full_chunked_upload_and_assembly_flow(): void
    {
        Queue::fake([ConvertIfcJob::class]);

        // Step 1: Initialize
        $contentPart1 = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n";
        $contentPart2 = "DATA;\n#1=IFCPROJECT('001',$,'Test',$,$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;\n";
        $totalBytes = strlen($contentPart1) + strlen($contentPart2);

        $initRes = $this->actingAs($this->admin)->postJson('/api/upload/init', [
            'fileName' => 'hospital_completo.ifc',
            'totalBytes' => $totalBytes,
            'totalChunks' => 2,
            'chunkSize' => strlen($contentPart1),
            'projectId' => $this->userProject->id,
        ]);

        $initRes->assertStatus(201)
            ->assertJsonStructure(['uploadId', 'projectId', 'chunkSize', 'totalChunks', 'totalBytes']);

        $uploadId = $initRes->json('uploadId');

        // Step 2: Upload Part 0
        $chunk0 = UploadedFile::fake()->createWithContent('chunk_0.part', $contentPart1);
        $chunk0Res = $this->actingAs($this->admin)->postJson('/api/upload/chunk', [
            'uploadId' => $uploadId,
            'chunkIndex' => 0,
            'file' => $chunk0,
        ]);
        $chunk0Res->assertStatus(200)
            ->assertJson(['uploadId' => $uploadId, 'chunkIndex' => 0]);

        // Step 3: Check Status (Resumption verification)
        $statusRes = $this->actingAs($this->admin)->getJson("/api/upload/status/{$uploadId}");
        $statusRes->assertStatus(200)
            ->assertJson([
                'uploadId' => $uploadId,
                'totalChunks' => 2,
                'uploadedChunks' => [0],
                'isComplete' => false,
            ]);

        // Step 4: Upload Part 1
        $chunk1 = UploadedFile::fake()->createWithContent('chunk_1.part', $contentPart2);
        $chunk1Res = $this->actingAs($this->admin)->postJson('/api/upload/chunk', [
            'uploadId' => $uploadId,
            'chunkIndex' => 1,
            'file' => $chunk1,
        ]);
        $chunk1Res->assertStatus(200);

        // Verify status shows complete
        $statusResAfter = $this->actingAs($this->admin)->getJson("/api/upload/status/{$uploadId}");
        $statusResAfter->assertJson(['isComplete' => true, 'uploadedChunks' => [0, 1]]);

        // Step 5: Complete and Assemble
        $completeRes = $this->actingAs($this->admin)->postJson('/api/upload/complete', [
            'uploadId' => $uploadId,
        ]);

        $completeRes->assertStatus(201)
            ->assertJsonStructure(['jobId', 'targetProjectId', 'progressUrl', 'fileName']);

        $jobId = $completeRes->json('jobId');

        $this->assertDatabaseHas('conversion_jobs', [
            'id' => $jobId,
            'project_id' => $this->userProject->id,
            'status' => 'queued',
        ]);

        Queue::assertPushed(ConvertIfcJob::class);
    }

    public function test_cancel_chunked_upload(): void
    {
        $initRes = $this->actingAs($this->admin)->postJson('/api/upload/init', [
            'fileName' => 'cancel_me.ifc',
            'totalBytes' => 200,
            'totalChunks' => 2,
            'chunkSize' => 100,
            'projectId' => $this->userProject->id,
        ]);

        $uploadId = $initRes->json('uploadId');

        $cancelRes = $this->actingAs($this->admin)->deleteJson("/api/upload/cancel/{$uploadId}");
        $cancelRes->assertStatus(200)
            ->assertJson(['cancelled' => true]);

        // Further status check should now return 404
        $this->actingAs($this->admin)->getJson("/api/upload/status/{$uploadId}")
            ->assertStatus(404);
    }
}
