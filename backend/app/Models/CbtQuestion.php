<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CbtQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject_id',
        'question',
        'question_type',
        'options',
        'correct_answer',
        'points',
        'explanation',
    ];

    protected $casts = [
        'options' => 'array',
        'correct_answer' => 'json',
        'points' => 'integer',
    ];

    /**
     * Get the subject this question belongs to
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(CbtSubject::class, 'subject_id');
    }

    /**
     * Get all student answers for this question
     */
    public function studentAnswers(): HasMany
    {
        return $this->hasMany(CbtStudentAnswer::class, 'question_id');
    }

    /**
     * Check if a student's answer is correct
     */
    public function checkAnswer($studentAnswer): bool
    {
        switch ($this->question_type) {
            case 'single_choice':
            case 'true_false':
                return strtolower(trim($studentAnswer)) === strtolower(trim($this->correct_answer));

            case 'multiple_choice':
                // Sort both arrays and compare
                $correctAnswers = is_array($this->correct_answer) ? $this->correct_answer : json_decode($this->correct_answer, true);
                $studentAnswers = is_array($studentAnswer) ? $studentAnswer : json_decode($studentAnswer, true);
                
                sort($correctAnswers);
                sort($studentAnswers);
                
                return $correctAnswers === $studentAnswers;

            case 'short_answer':
                // Case-insensitive comparison, trimmed
                return strtolower(trim($studentAnswer)) === strtolower(trim($this->correct_answer));

            case 'long_answer':
                // Cannot auto-grade, requires manual grading
                return false;

            default:
                return false;
        }
    }

    /**
     * Calculate marks for a student's answer
     */
    public function calculateMarks($studentAnswer): ?float
    {
        if ($this->question_type === 'long_answer') {
            // Requires manual grading
            return null;
        }

        return $this->checkAnswer($studentAnswer) ? $this->points : 0;
    }

    /**
     * Check if question requires manual grading
     */
    public function requiresManualGrading(): bool
    {
        return $this->question_type === 'long_answer';
    }

    /**
     * Format options for display
     */
    public function getFormattedOptions(): ?array
    {
        if (!$this->options) {
            return null;
        }

        if (is_string($this->options)) {
            return json_decode($this->options, true);
        }

        return $this->options;
    }
}
