<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $table = 'exam_questions';
    protected $fillable = [
        'exam_id', 'question_text', 'question_type', 'marks', 'difficulty_level', 'metadata'
    ];

    protected $casts = [
        'metadata' => 'array'
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
