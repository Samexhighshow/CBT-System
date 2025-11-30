<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class CbtStudentExam extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'subject_id',
        'selected_questions',
        'start_time',
        'end_time',
        'submitted_at',
        'status',
        'score',
        'total_marks',
        'duration_seconds',
        'requires_manual_grading',
    ];

    protected $casts = [
        'selected_questions' => 'array',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'submitted_at' => 'datetime',
        'score' => 'decimal:2',
        'total_marks' => 'decimal:2',
        'duration_seconds' => 'integer',
        'requires_manual_grading' => 'boolean',
    ];

    /**
     * Get the student who took the exam
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Get the subject for this exam
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(CbtSubject::class, 'subject_id');
    }

    /**
     * Get all answers for this exam
     */
    public function answers(): HasMany
    {
        return $this->hasMany(CbtStudentAnswer::class, 'student_exam_id');
    }

    /**
     * Get the questions for this exam instance
     */
    public function questions()
    {
        if (!$this->selected_questions) {
            return collect([]);
        }

        return CbtQuestion::whereIn('id', $this->selected_questions)
            ->orderByRaw('FIELD(id, ' . implode(',', $this->selected_questions) . ')')
            ->get();
    }

    /**
     * Check if exam has expired
     */
    public function hasExpired(): bool
    {
        if (!$this->end_time) {
            return false;
        }

        return Carbon::now()->isAfter($this->end_time);
    }

    /**
     * Get time remaining in seconds
     */
    public function getTimeRemaining(): int
    {
        if (!$this->end_time || $this->status === 'submitted') {
            return 0;
        }

        $remaining = Carbon::now()->diffInSeconds($this->end_time, false);
        return max(0, $remaining);
    }

    /**
     * Check if exam is in progress
     */
    public function isInProgress(): bool
    {
        return $this->status === 'in_progress' && !$this->hasExpired();
    }

    /**
     * Start the exam
     */
    public function startExam(): void
    {
        $this->start_time = Carbon::now();
        $this->end_time = Carbon::now()->addMinutes($this->subject->duration_minutes);
        $this->status = 'in_progress';
        $this->save();
    }

    /**
     * Submit the exam
     */
    public function submitExam(): void
    {
        $this->submitted_at = Carbon::now();
        $this->status = 'submitted';
        
        // Calculate duration
        if ($this->start_time) {
            $this->duration_seconds = Carbon::parse($this->start_time)->diffInSeconds($this->submitted_at);
        }
        
        $this->save();
    }

    /**
     * Calculate and update score
     */
    public function calculateScore(): void
    {
        $totalScore = 0;
        $totalMarks = 0;
        $requiresManualGrading = false;

        foreach ($this->answers as $answer) {
            $question = $answer->question;
            $totalMarks += $question->points;

            if ($question->requiresManualGrading()) {
                $requiresManualGrading = true;
                // Don't add to score yet, will be graded manually
            } else {
                $totalScore += $answer->marks_awarded ?? 0;
            }
        }

        $this->score = $totalScore;
        $this->total_marks = $totalMarks;
        $this->requires_manual_grading = $requiresManualGrading;
        $this->status = $requiresManualGrading ? 'submitted' : 'graded';
        $this->save();
    }

    /**
     * Get percentage score
     */
    public function getPercentage(): ?float
    {
        if (!$this->total_marks || $this->total_marks == 0) {
            return null;
        }

        return round(($this->score / $this->total_marks) * 100, 2);
    }

    /**
     * Get grade letter
     */
    public function getGrade(): ?string
    {
        $percentage = $this->getPercentage();
        
        if ($percentage === null) {
            return null;
        }

        if ($percentage >= 70) return 'A';
        if ($percentage >= 60) return 'B';
        if ($percentage >= 50) return 'C';
        if ($percentage >= 45) return 'D';
        if ($percentage >= 40) return 'E';
        return 'F';
    }
}
