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
        'student_id',
        'device_id',
        'started_at',
        'ends_at',
        'ended_at',
        'submitted_at',
        'last_activity_at',
        'switch_count',
        'question_order',
        'duration_seconds',
        'score',
        'status',
        'synced_at',
        'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ends_at' => 'datetime',
        'ended_at' => 'datetime',
        'submitted_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'synced_at' => 'datetime',
        'completed_at' => 'datetime',
        'question_order' => 'array',
        'switch_count' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
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
