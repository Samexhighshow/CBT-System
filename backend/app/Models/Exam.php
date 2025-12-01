<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    protected $table = 'exams';
    protected $fillable = [
        'title', 'description', 'subject_id', 'class_level', 'department', 
        'duration', 'duration_minutes', 'total_marks', 'passing_marks',
        'start_time', 'end_time', 'status', 'published', 'metadata'
    ];

    protected $casts = [
        'published' => 'boolean',
        'metadata' => 'array'
    ];

    public function questions()
    {
        return $this->hasMany(Question::class, 'exam_id');
    }

    public function attempts()
    {
        return $this->hasMany(ExamAttempt::class);
    }
}
