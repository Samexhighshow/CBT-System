<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    protected $table = 'students';
    protected $fillable = [
        'student_id', 'first_name', 'last_name', 'email', 'phone', 'class_level', 'department', 'trade_subjects', 'is_active', 'department_id', 'password', 'registration_number', 'other_names', 'phone_number', 'date_of_birth', 'gender', 'address', 'status'
    ];

    protected $casts = [
        'trade_subjects' => 'array',
        'is_active' => 'boolean',
        'date_of_birth' => 'date',
    ];

    protected $hidden = ['password'];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'student_subjects');
    }

    public function examAttempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function exams(): BelongsToMany
    {
        return $this->belongsToMany(Exam::class, 'exam_attempts')->withPivot('score', 'status', 'started_at', 'ended_at');
    }
}