<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CbtSubject extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject_name',
        'class_level',
        'owner_id',
        'shuffle_questions',
        'questions_required',
        'total_marks',
        'duration_minutes',
        'is_active',
        'description',
    ];

    protected $casts = [
        'shuffle_questions' => 'boolean',
        'is_active' => 'boolean',
        'questions_required' => 'integer',
        'total_marks' => 'integer',
        'duration_minutes' => 'integer',
    ];

    /**
     * Get the owner (teacher/admin) of the subject
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get all questions for this subject
     */
    public function questions(): HasMany
    {
        return $this->hasMany(CbtQuestion::class, 'subject_id');
    }

    /**
     * Get all student exams for this subject
     */
    public function studentExams(): HasMany
    {
        return $this->hasMany(CbtStudentExam::class, 'subject_id');
    }

    /**
     * Get active questions for this subject
     */
    public function activeQuestions(): HasMany
    {
        return $this->questions();
    }

    /**
     * Check if subject has enough questions for shuffling
     */
    public function hasEnoughQuestionsForShuffle(): bool
    {
        if (!$this->shuffle_questions) {
            return true; // No shuffle, any amount is fine
        }
        
        $questionCount = $this->questions()->count();
        
        // Must have at least questions_required questions
        // But ideally should have more for true shuffling
        return $questionCount >= $this->questions_required;
    }

    /**
     * Get the minimum questions required for shuffling
     * Rule: If shuffle is ON, must have more questions than required
     */
    public function getMinimumQuestionsForShuffle(): int
    {
        return $this->shuffle_questions ? $this->questions_required : $this->questions_required;
    }

    /**
     * Validate shuffle settings
     */
    public function validateShuffleSettings(): array
    {
        $questionCount = $this->questions()->count();
        $errors = [];

        if ($this->shuffle_questions && $questionCount < $this->questions_required) {
            $errors[] = "Shuffle is enabled but you only have {$questionCount} questions. You need at least {$this->questions_required} questions.";
        }

        if ($this->shuffle_questions && $questionCount == $this->questions_required) {
            $errors[] = "For effective shuffling, you should have more than {$this->questions_required} questions. Currently you have exactly {$questionCount}.";
        }

        return $errors;
    }
}
