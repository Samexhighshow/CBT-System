<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class ExamAttempt extends Model
{
    protected $table = 'exam_attempts';
    protected $fillable = [
        'attempt_uuid',
        'exam_id',
        'exam_sitting_id',
        'student_id',
        'device_id',
        'started_at',
        'ends_at',
        'ended_at',
        'client_started_at',
        'client_submitted_at',
        'server_started_at',
        'server_submitted_at',
        'time_anomaly_flag',
        'time_anomaly_reason',
        'submitted_at',
        'last_activity_at',
        'switch_count',
        'question_order',
        'assessment_mode',
        'duration_seconds',
        'score',
        'status',
        'sync_status',
        'sync_version',
        'extra_time_minutes',
        'synced_at',
        'completed_at',
        'finalized_at',
        'finalized_by',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ends_at' => 'datetime',
        'ended_at' => 'datetime',
        'client_started_at' => 'datetime',
        'client_submitted_at' => 'datetime',
        'server_started_at' => 'datetime',
        'server_submitted_at' => 'datetime',
        'time_anomaly_flag' => 'boolean',
        'submitted_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'synced_at' => 'datetime',
        'completed_at' => 'datetime',
        'finalized_at' => 'datetime',
        'question_order' => 'array',
        'switch_count' => 'integer',
        'sync_version' => 'integer',
        'extra_time_minutes' => 'integer',
        'finalized_by' => 'integer',
        'exam_sitting_id' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function examSitting(): BelongsTo
    {
        return $this->belongsTo(ExamSitting::class, 'exam_sitting_id');
    }

    public function examAnswers(): HasMany
    {
        return $this->hasMany(ExamAnswer::class, 'attempt_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ExamAttemptSession::class, 'attempt_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ExamAttemptEvent::class, 'attempt_id');
    }

    public function isSubmitted(): bool
    {
        return in_array($this->status, ['submitted', 'completed'], true);
    }

    public function isExpired(): bool
    {
        return $this->ends_at instanceof Carbon && now()->greaterThan($this->ends_at) && !$this->isSubmitted();
    }
}
