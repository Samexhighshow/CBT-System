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
        'class_id',
        'class_level',
        'department_id',
        'subject_type',
        'is_active'
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
     * Get departments available for this subject's class.
     * Departments are filtered by matching their class_level to the subject's class name.
     */
    public function availableDepartments()
    {
        if (!$this->schoolClass) {
            return collect([]);
        }
        return $this->schoolClass->departments();
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
     * Get the subject type description
     */
    public function getTypeDescription(): string
    {
        return $this->subject_type === 'core' ? 'Core (mandatory)' : 'Elective (optional)';
    }
}
