<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Subject extends Model
{
    protected $table = 'subjects';
    protected $fillable = [
        'name', 
        'code', 
        'description', 
        'is_compulsory', 
        'class_level', 
        'class_id',
        'department_id',
        'subject_type',
        'is_active',
        'subject_group', 
        'class_levels', 
        'departments'
    ];

    protected $casts = [
        'is_compulsory' => 'boolean',
        'is_active' => 'boolean',
        'class_levels' => 'array',
        'departments' => 'array',
    ];

    /**
     * Get the class this subject belongs to
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    /**
     * Get the department this subject belongs to (for SSS subjects)
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Many-to-many relationship with departments
     */
    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'department_subjects')
            ->withPivot('is_compulsory', 'is_core')
            ->withTimestamps();
    }

    /**
     * Students taking this subject
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_subjects');
    }

    /**
     * Check if this is a core subject
     */
    public function isCoreSubject(): bool
    {
        return $this->subject_type === 'core' || $this->is_compulsory;
    }

    /**
     * Check if this subject requires a department (SSS subjects)
     */
    public function requiresDepartment(): bool
    {
        return in_array($this->class_level, ['SSS 1', 'SSS 2', 'SSS 3', 'SSS']);
    }
}
