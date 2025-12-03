<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $table = 'exam_questions';
    protected $fillable = [
        'exam_id', 
        'question_text', 
        'question_type', 
        'marks', 
        'difficulty_level', 
        'max_words',
        'marking_rubric',
        'metadata'
    ];

    protected $casts = [
        'metadata' => 'array',
        'marks' => 'integer',
        'max_words' => 'integer',
    ];

    public function exam()
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    public function options()
    {
        return $this->hasMany(QuestionOption::class, 'question_id');
    }
}
