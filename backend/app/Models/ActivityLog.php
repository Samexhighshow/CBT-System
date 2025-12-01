<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    use HasFactory;

    protected $table = 'activity_log';

    protected $fillable = [
        'log_name',
        'description',
        'subject_type',
        'subject_id',
        'event',
        'causer_type',
        'causer_id',
        'properties',
        'batch_uuid',
    ];

    protected $casts = [
        'properties' => 'array',
    ];

    /**
     * Get the subject model.
     */
    public function subject()
    {
        return $this->morphTo();
    }

    /**
     * Get the causer model (user who performed the action).
     */
    public function causer()
    {
        return $this->morphTo();
    }

    /**
     * Log an activity.
     */
    public static function logActivity(
        string $description,
        $subject = null,
        string $event = null,
        array $properties = []
    ): self {
        return self::create([
            'log_name' => 'default',
            'description' => $description,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject ? $subject->id : null,
            'event' => $event,
            'causer_type' => auth()->check() ? get_class(auth()->user()) : null,
            'causer_id' => auth()->id(),
            'properties' => $properties,
        ]);
    }
}
