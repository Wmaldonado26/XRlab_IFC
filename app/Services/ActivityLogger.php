<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    public function record(
        string $action,
        string $resourceType,
        string|int|null $resourceId,
        ?string $resourceName = null,
        ?string $projectId = null,
        array $details = [],
        ?User $actor = null
    ): void {
        $actor ??= Auth::user();
        $project = $projectId ? Project::find($projectId) : null;
        $request = app()->runningInConsole() ? null : request();

        ActivityLog::create([
            'user_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_email' => $actor?->email,
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId === null ? null : (string) $resourceId,
            'resource_name' => $resourceName,
            'project_id' => $projectId,
            'project_name' => $project?->name,
            'result' => 'success',
            'details' => $details ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'created_at' => now(),
        ]);
    }
}
