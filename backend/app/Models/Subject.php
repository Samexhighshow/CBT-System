<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Subject extends Model
{
    protected $table = 'subjects';
    protected $fillable = [
        'name', 'code', 'description', 'is_compulsory', 'class_level', 'is_active',
        'subject_group', 'class_levels', 'departments'
    ];

    protected $casts = [
        'is_compulsory' => 'boolean',
        'is_active' => 'boolean',
        'class_levels' => 'array',
        'departments' => 'array',
    ];

    public function departmentRelations(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'department_subjects');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_subjects');
    }
}
