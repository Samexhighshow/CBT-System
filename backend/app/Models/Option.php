<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Option extends Model
{
    protected $table = 'question_options';
    protected $fillable = [
        'question_id', 'option_text', 'is_correct'
    ];

    protected $casts = [
        'is_correct' => 'boolean'
    ];
}
