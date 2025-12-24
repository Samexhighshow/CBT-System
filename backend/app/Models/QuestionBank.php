<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * QuestionBank Model - Independent Question Storage
 * 
 * This is the central question bank, completely independent from exams.
 * Exams will reference questions from here, not own them.
 */
class QuestionBank extends Model
{
    use SoftDeletes;

    protected $table = 'questions';

    protected $fillable = [
        'question_text',
        'question_type',
        'marks',
        'difficulty',
        'subject_id',
        'class_level',
        'instructions',
        'status',
        'created_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Question options (for MCQ, checkbox, true/false)
     */
    public function options(): HasMany
    {
        return $this->hasMany(QuestionBankOption::class, 'question_id')->orderBy('sort_order');
    }

    /**
     * Question versions
     */
    public function versions(): HasMany
    {
        return $this->hasMany(QuestionBankVersion::class, 'question_id')->orderByDesc('version_number');
    }

    /**
     * Tags
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(QuestionTag::class, 'question_tag', 'question_id', 'question_tag_id');
    }

    /**
     * Subject
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Creator
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get active questions only
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }

    /**
     * Get draft questions
     */
    public function scopeDraft($query)
    {
        return $query->where('status', 'Draft');
    }

    /**
     * Get by subject
     */
    public function scopeBySubject($query, $subjectId)
    {
        return $query->where('subject_id', $subjectId);
    }

    /**
     * Get by class level
     */
    public function scopeByClassLevel($query, $classLevel)
    {
        return $query->where('class_level', $classLevel);
    }

    /**
     * Get by type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('question_type', $type);
    }

    /**
     * Get by difficulty
     */
    public function scopeByDifficulty($query, $difficulty)
    {
        return $query->where('difficulty', $difficulty);
    }

    /**
     * Search by question text
     */
    public function scopeSearchText($query, $text)
    {
        return $query->where('question_text', 'like', "%{$text}%");
    }
}
