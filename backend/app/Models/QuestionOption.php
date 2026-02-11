<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionOption extends Model
{
    use HasFactory;

    protected $table = 'question_options';
    protected $fillable = [
        'question_id', 
        'option_text', 
        'option_media',
        'is_correct',
        'order_index'
    ];

    protected $casts = [
        'is_correct' => 'boolean',
        'option_media' => 'array',
        'order_index' => 'integer',
    ];

    /**
     * Relationship to Question
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class, 'question_id');
    }

    /**
     * Scope to get only correct answers
     */
    public function scopeCorrect($query)
    {
        return $query->where('is_correct', true);
    }

    /**
     * Scope to order by display order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order_index');
    }
}
