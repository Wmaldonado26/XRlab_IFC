<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ConversionJob extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'conversion_jobs';

    protected $fillable = [
        'id',
        'project_id',
        'model_id',
        'status',
        'progress',
        'stage',
        'error_message',
        'parts_json',
        'original_ifc_name',
        'original_ifc_path',
        'total_size_bytes',
    ];

    protected function casts(): array
    {
        return [
            'progress' => 'integer',
            'parts_json' => 'array',
            'total_size_bytes' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ConversionJob $job) {
            if (empty($job->id)) {
                $job->id = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }
}
