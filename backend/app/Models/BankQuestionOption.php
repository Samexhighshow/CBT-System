<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankQuestionOption extends Model
{
    protected $table = 'bank_question_options';

    protected $fillable = [
        'bank_question_id',
        'option_text',
        'is_correct',
        'sort_order',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function question()
    {
        return $this->belongsTo(BankQuestion::class, 'bank_question_id');
    }
}
