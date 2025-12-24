<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankQuestionTag extends Model
{
    protected $table = 'bank_question_tags';

    protected $fillable = [
        'name',
        'description',
    ];

    public function questions()
    {
        return $this->belongsToMany(BankQuestion::class, 'bank_question_tag', 'bank_question_tag_id', 'bank_question_id');
    }
}
