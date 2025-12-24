<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankQuestionVersion extends Model
{
    protected $table = 'bank_question_versions';

    protected $fillable = [
        'bank_question_id',
        'version_number',
        'question_text',
        'question_type',
        'marks',
        'difficulty',
        'instructions',
        'created_by',
        'change_notes',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'marks' => 'integer',
    ];

    public function question()
    {
        return $this->belongsTo(BankQuestion::class, 'bank_question_id');
    }
}
