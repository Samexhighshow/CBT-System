<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class OfflineLoginSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Configure offline PIN hashes for admin/teacher users.
     * PIN should be SHA-256 hashed.
     */
    public function run(): void
    {
        // Intentionally left blank. Use `php artisan offline:set-pin` per user.
    }
}
