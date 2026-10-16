<?php

namespace Tests\Feature;

use App\Jobs\ConvertIfcJob;
use App\Models\ConversionJob;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ConversionTest extends TestCase
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

        $this->userProject = Project::create(['name' => 'Proyecto Usuario']);
        $this->normalUser->projects()->attach($this->userProject->id, ['assigned_at' => now()->timestamp]);
    }

    public function test_unauthenticated_request_to_convert_is_rejected(): void
    {
        $response = $this->postJson('/api/convert');

        $response->assertStatus(401);
    }

    public function test_upload_non_ifc_file_is_rejected(): void
    {
        $fakeFile = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $response = $this->actingAs($this->admin)->postJson('/api/convert', [
            'file' => $fakeFile,
        ]);

        $response->assertStatus(400)
            ->assertJson([
                'error' => 'Solo se admiten archivos con formato IFC (.ifc).',
            ]);
    }

    public function test_authenticated_user_can_submit_ifc_and_receive_job(): void
    {
        Queue::fake([ConvertIfcJob::class]);

        $fakeIfc = UploadedFile::fake()->create('edificio_prueba.ifc', 50, 'text/plain');

        $response = $this->actingAs($this->admin)->postJson('/api/convert', [
            'file' => $fakeIfc,
            'projectId' => $this->userProject->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'jobId',
                'targetProjectId',
                'progressUrl',
                'fileName',
            ]);

        $jobId = $response->json('jobId');
        $this->assertDatabaseHas('conversion_jobs', [
            'id' => $jobId,
            'project_id' => $this->userProject->id,
            'status' => 'queued',
        ]);
    }

    public function test_unauthorized_user_cannot_access_other_users_job_status(): void
    {
        $otherProject = Project::create(['name' => 'Proyecto Ajeno']);
        $job = ConversionJob::create([
            'project_id' => $otherProject->id,
            'status' => 'queued',
            'progress' => 0,
        ]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/jobs/{$job->id}/status");

        $response->assertStatus(403);
    }

    public function test_user_can_check_job_status(): void
    {
        $job = ConversionJob::create([
            'project_id' => $this->userProject->id,
            'status' => 'completed',
            'progress' => 100,
            'parts_json' => ['parte1.frag'],
        ]);

        $response = $this->actingAs($this->normalUser)->getJson("/api/jobs/{$job->id}/status");

        $response->assertStatus(200)
            ->assertJson([
                'id' => $job->id,
                'projectId' => $this->userProject->id,
                'status' => 'completed',
                'progress' => 100,
                'parts' => ['parte1.frag'],
            ]);
    }
}
