<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamAttemptSession extends Model
{
    protected $table = 'exam_attempt_sessions';

    protected $fillable = [
        'attempt_id',
        'session_token_hash',
        'device_id',
        'ip_address',
        'user_agent',
        'is_active',
        'revoked_reason',
        'started_at',
        'last_seen_at',
        'ended_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'started_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }
}
