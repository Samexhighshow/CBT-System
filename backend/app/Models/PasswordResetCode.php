<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PasswordResetCode extends Model
{
    use HasFactory;
    protected $fillable = ['email','code','expires_at','used_at'];
    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];
}
