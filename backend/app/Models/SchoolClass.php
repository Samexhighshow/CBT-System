<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolClass extends Model
{
    use HasFactory;

    protected $table = 'school_classes';

    protected $fillable = [
        'name',
        'code',
        'department_id',
        'description',
        'capacity',
        'is_active',
        'metadata'
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get the department that owns the class.
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Get the students for the class.
     */
    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'class_id');
    }

    /**
     * Get subjects for this class
     */
    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'class_id');
    }

    /**
     * Check if this is an SSS class
     */
    public function isSSSClass(): bool
    {
        return str_contains(strtoupper($this->name), 'SSS');
    }

    /**
     * Get class level (e.g., SSS 1, JSS 2, Primary 4)
     */
    public function getClassLevel(): string
    {
        // Extract level from class name (e.g., "SSS 1" from "SSS 1A")
        if (preg_match('/(Primary|JSS|SSS)\s*\d+/i', $this->name, $matches)) {
            return $matches[0];
        }
        return $this->name;
    }
}
