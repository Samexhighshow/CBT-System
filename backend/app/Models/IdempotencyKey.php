<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IdempotencyKey extends Model
{
    protected $fillable = [
        'idempotency_key',
        'exam_id',
        'student_id',
        'request_hash',
        'response_status',
        'response_json',
    ];
}

