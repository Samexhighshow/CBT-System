<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuestionPool extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'name',
        'description',
        'question_count',
        'total_marks',
        'draw_count',
        'is_active',
    ];

    protected $casts = [
        'exam_id' => 'integer',
        'question_count' => 'integer',
        'total_marks' => 'integer',
        'draw_count' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * The exam this pool belongs to
     */
    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    /**
     * Questions in this pool
     */
    public function questions(): HasMany
    {
        return $this->hasMany(Question::class, 'pool_name', 'name')
            ->where('exam_id', $this->exam_id);
    }

    /**
     * Update pool statistics
     */
    public function updateStats(): void
    {
        $questions = $this->questions;
        $this->question_count = $questions->count();
        $this->total_marks = $questions->sum('marks');
        $this->save();
    }

    /**
     * Get active pools for an exam
     */
    public static function getActiveForExam(int $examId)
    {
        return self::where('exam_id', $examId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
    }

    /**
     * Draw random questions from this pool
     */
    public function drawQuestions(?int $count = null)
    {
        $count = $count ?? $this->draw_count ?? $this->question_count;
        
        return $this->questions()
            ->where('status', 'active')
            ->inRandomOrder()
            ->limit($count)
            ->get();
    }
}
