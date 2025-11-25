<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $table = 'students';
    protected $fillable = [
        'student_id', 'first_name', 'last_name', 'email', 'phone', 'class_level', 'department', 'trade_subjects', 'is_active'
    ];

    protected $casts = [
        'trade_subjects' => 'array',
        'is_active' => 'boolean'
    ];
}

