<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    protected $table = 'exam_attempts';
    protected $fillable = [
        'attempt_uuid', 'exam_id', 'student_id', 'device_id', 'started_at', 'ended_at', 'duration_seconds', 'score', 'status', 'synced_at', 'completed_at'
    ];

    protected $dates = ['started_at','ended_at','synced_at','completed_at'];

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
}
