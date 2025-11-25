<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    protected $table = 'subjects';
    protected $fillable = [
        'name', 'description', 'is_compulsory', 'class_level', 'is_active'
    ];

    protected $casts = [
        'is_compulsory' => 'boolean',
        'is_active' => 'boolean'
    ];

    public function departments()
    {
        return $this->belongsToMany(Department::class, 'department_subjects');
    }
}
