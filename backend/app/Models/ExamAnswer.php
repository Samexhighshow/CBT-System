<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class ExamAnswer extends Model
{
    protected $table = 'student_answers';
    
    protected $fillable = [
        'attempt_id',
        'question_id',
        'option_id',
        'answer_text',
        'flagged',
        'saved_at',
        'is_correct',
        'marks_awarded',
        'feedback',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'flagged' => 'boolean',
        'saved_at' => 'datetime',
        'is_correct' => 'boolean',
        'marks_awarded' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(QuestionOption::class, 'option_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
