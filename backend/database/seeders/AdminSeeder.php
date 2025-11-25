<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run()
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@cbtsystem.local'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('admin123456')
            ]
        );

        if (!$admin->hasRole('Admin')) {
            $admin->assignRole('Admin');
        }
    }
}
