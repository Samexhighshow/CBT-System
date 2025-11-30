<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $table = 'departments';
    protected $fillable = [
        'name', 'code', 'description', 'class_level', 'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean'
    ];


    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'department_subjects');
    }

    public function students()
    {
        return $this->hasMany(Student::class, 'department_id');
    }

    public function tradeSubjects()
    {
        return $this->hasMany(TradeSubject::class);
    }

    public function exams()
    {
        // Exams table stores department as a string field; map by name
        return $this->hasMany(Exam::class, 'department', 'name');
    }
}
