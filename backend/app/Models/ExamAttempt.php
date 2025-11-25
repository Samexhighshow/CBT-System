<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamAttempt extends Model
{
    protected $table = 'exam_attempts';
    protected $fillable = [
        'attempt_uuid', 'exam_id', 'student_id', 'device_id', 'started_at', 'ended_at', 'duration_seconds', 'score', 'status', 'synced_at'
    ];

    protected $dates = ['started_at','ended_at','synced_at'];
}
