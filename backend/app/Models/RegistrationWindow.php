<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistrationWindow extends Model
{
    protected $table = 'registration_windows';
    protected $fillable = [
        'name', 'start_at', 'end_at', 'status', 'is_active'
    ];

    protected $dates = ['start_at', 'end_at'];

    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function isOpen()
    {
        $now = now();
        return $this->start_at <= $now && $now <= $this->end_at && $this->is_active;
    }
}

