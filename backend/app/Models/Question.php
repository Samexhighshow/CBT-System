<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $table = 'exam_questions';
    protected $fillable = [
        'exam_id', 'question_text', 'question_type', 'metadata'
    ];

    protected $casts = [
        'metadata' => 'array'
    ];
}
