<?php

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

// Disable foreign key checks temporarily
DB::statement('SET FOREIGN_KEY_CHECKS=0');

// Delete all users
User::query()->delete();
echo "✓ All users deleted\n";

// Re-enable foreign key checks
DB::statement('SET FOREIGN_KEY_CHECKS=1');

// Create new admin user
$admin = User::create([
    'name' => 'Ishola Samuel',
    'email' => 'isholasamuel062@gmail.com',
    'password' => Hash::make('Samex1122'),
    'email_verified_at' => \Carbon\Carbon::now(),
]);

echo "✓ Admin user created:\n";
echo "  Name: " . $admin->name . "\n";
echo "  Email: " . $admin->email . "\n";
echo "  ID: " . $admin->id . "\n";

// Verify
$user = User::where('email', 'isholasamuel062@gmail.com')->first();
if ($user && Hash::check('Samex1122', $user->password)) {
    echo "✓ Password verified\n";
} else {
    echo "✗ Password verification failed\n";
}
