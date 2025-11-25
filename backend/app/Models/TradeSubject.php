<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TradeSubject extends Model
{
    protected $table = 'trade_subjects';
    protected $fillable = [
        'name', 'description', 'department_id', 'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}
