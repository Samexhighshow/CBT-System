<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HallTeacher extends Model
{
    use HasFactory;

    protected $fillable = [
        'hall_id',
        'teacher_id',
        'exam_id',
        'role',
        'assigned_at',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    /**
     * Get the hall this assignment belongs to
     */
    public function hall()
    {
        return $this->belongsTo(Hall::class);
    }

    /**
     * Get the teacher (user)
     */
    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /**
     * Get the exam
     */
    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }
}
