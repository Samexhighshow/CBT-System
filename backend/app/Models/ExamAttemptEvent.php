<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamAttemptEvent extends Model
{
    public $timestamps = false;

    protected $table = 'exam_attempt_events';

    protected $fillable = [
        'attempt_id',
        'event_type',
        'meta_json',
        'created_at',
    ];

    protected $casts = [
        'meta_json' => 'array',
        'created_at' => 'datetime',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }
}
