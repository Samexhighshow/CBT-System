<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, Notifiable, HasRoles, HasFactory;

    protected $fillable = [
        'name',
        'email',
        'password',
        'must_change_password',
        'onboarding_source',
        'offline_login_enabled',
        'offline_pin_hash',
        'profile_picture',
        'phone_number',
        'two_factor_enabled',
        'two_factor_type',
        'google2fa_secret',
        'google2fa_secret_temp',
        'two_factor_code',
        'two_factor_expires_at'
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'offline_pin_hash',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'offline_login_enabled' => 'boolean',
        'must_change_password' => 'boolean',
    ];
}
