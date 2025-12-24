<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionBankVersion extends Model
{
    protected $table = 'question_versions';

    protected $fillable = [
        'question_id',
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
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Belongs to question
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class, 'question_id');
    }

    /**
     * Creator
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
