<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $table = 'departments';
    protected $fillable = [
        'name', 'description', 'class_level', 'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function subjects()
    {
        return $this->belongsToMany(Subject::class, 'department_subjects');
    }

    public function tradeSubjects()
    {
        return $this->hasMany(TradeSubject::class);
    }
}
