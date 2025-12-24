<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class QuestionTag extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
        'color',
        'description',
        'question_count',
    ];

    /**
     * Questions with this tag
     */
    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(QuestionBank::class, 'question_tag', 'question_tag_id', 'question_id');
    }

    protected $casts = [
        'question_count' => 'integer',
    ];

    /**
     * Questions that have this tag
     */
    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(
            Question::class,
            'question_tag_pivot',
            'tag_id',
            'question_id'
        )->withTimestamps();
    }

    /**
     * Update the question count for this tag
     */
    public function updateQuestionCount(): void
    {
        $this->question_count = $this->questions()->count();
        $this->save();
    }

    /**
     * Get tags by category
     */
    public static function getByCategory(string $category)
    {
        return self::where('category', $category)->orderBy('name')->get();
    }

    /**
     * Get popular tags (most used)
     */
    public static function getPopular(int $limit = 10)
    {
        return self::orderByDesc('question_count')->limit($limit)->get();
    }
}
