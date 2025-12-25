<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class BankQuestion extends Model
{
    use SoftDeletes;

    protected $table = 'bank_questions';

    protected $fillable = [
        'question_text',
        'question_type',
        'marks',
        'difficulty',
        'subject_id',
        'class_level',
        'instructions',
        'status',
        'created_by',
    ];

    protected $casts = [
        'marks' => 'integer',
    ];

    public function options()
    {
        return $this->hasMany(BankQuestionOption::class, 'bank_question_id')->orderBy('sort_order');
    }

    public function versions()
    {
        return $this->hasMany(BankQuestionVersion::class, 'bank_question_id')->orderByDesc('version_number');
    }

    public function tags()
    {
        return $this->belongsToMany(BankQuestionTag::class, 'bank_question_tag', 'bank_question_id', 'bank_question_tag_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Get usage count (exams using this question)
     * For future implementation when exam_questions references bank_questions
     */
    public function getUsageCountAttribute()
    {
        return (int) DB::table('exam_questions')
            ->where('bank_question_id', $this->id)
            ->distinct('exam_id')
            ->count('exam_id');
    }
}
