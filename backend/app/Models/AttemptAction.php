<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttemptAction extends Model
{
    protected $fillable = [
        'attempt_id',
        'exam_id',
        'student_id',
        'actor_user_id',
        'action_type',
        'meta_json',
    ];

    protected $casts = [
        'meta_json' => 'array',
    ];
}

