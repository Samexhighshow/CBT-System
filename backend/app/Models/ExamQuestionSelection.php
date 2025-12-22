<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamQuestionSelection extends Model
{
    protected $fillable = [
        'exam_id',
        'student_id',
        'user_id',
        'question_ids',
        'option_shuffles',
        'total_questions',
        'total_marks',
        'distribution_summary',
        'is_locked',
        'locked_at',
    ];

    protected $casts = [
        'question_ids' => 'array',
        'option_shuffles' => 'array',
        'distribution_summary' => 'array',
        'is_locked' => 'boolean',
        'locked_at' => 'datetime',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
