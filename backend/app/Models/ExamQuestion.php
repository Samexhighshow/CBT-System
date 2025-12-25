<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamQuestion extends Model
{
    protected $table = 'exam_questions';

    protected $fillable = [
        'exam_id',
        'bank_question_id',
        'version_number',
        'order_index',
        'marks_override',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'order_index' => 'integer',
        'marks_override' => 'integer',
    ];

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function bankQuestion()
    {
        return $this->belongsTo(BankQuestion::class, 'bank_question_id');
    }
}
