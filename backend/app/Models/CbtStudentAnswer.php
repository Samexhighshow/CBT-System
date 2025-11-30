<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CbtStudentAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_exam_id',
        'question_id',
        'answer',
        'marks_awarded',
        'is_correct',
        'manually_graded',
        'teacher_feedback',
        'graded_by',
        'graded_at',
    ];

    protected $casts = [
        'answer' => 'json',
        'marks_awarded' => 'decimal:2',
        'is_correct' => 'boolean',
        'manually_graded' => 'boolean',
        'graded_at' => 'datetime',
    ];

    /**
     * Get the student exam this answer belongs to
     */
    public function studentExam(): BelongsTo
    {
        return $this->belongsTo(CbtStudentExam::class, 'student_exam_id');
    }

    /**
     * Get the question this answer is for
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(CbtQuestion::class, 'question_id');
    }

    /**
     * Get the teacher who graded this answer
     */
    public function gradedByTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'graded_by');
    }

    /**
     * Auto-grade the answer
     */
    public function autoGrade(): void
    {
        $question = $this->question;

        // Only auto-grade if not a long answer
        if ($question->requiresManualGrading()) {
            return;
        }

        $this->is_correct = $question->checkAnswer($this->answer);
        $this->marks_awarded = $this->is_correct ? $question->points : 0;
        $this->save();
    }

    /**
     * Manually grade the answer
     */
    public function manualGrade(float $marks, ?string $feedback = null, int $gradedBy = null): void
    {
        $this->marks_awarded = $marks;
        $this->manually_graded = true;
        $this->teacher_feedback = $feedback;
        $this->graded_by = $gradedBy;
        $this->graded_at = now();
        $this->is_correct = $marks > 0;
        $this->save();
    }

    /**
     * Get formatted answer for display
     */
    public function getFormattedAnswer(): string
    {
        if (is_null($this->answer)) {
            return 'No answer provided';
        }

        if (is_array($this->answer)) {
            return implode(', ', $this->answer);
        }

        return (string) $this->answer;
    }
}
