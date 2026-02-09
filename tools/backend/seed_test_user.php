<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$hasher = app('hash');

// Check if test user exists
$existing = DB::table('users')->where('email', 'admin@test.com')->first();
if ($existing) {
    echo "User admin@test.com already exists (ID: {$existing->id})\n";
} else {
    // Create test user
    DB::table('users')->insert([
        'name' => 'Test Admin',
        'email' => 'admin@test.com',
        'password' => $hasher->make('password'),
        'email_verified_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "Created user: admin@test.com / password\n";
}

// Show all users
$users = DB::table('users')->select('id', 'email', 'name')->get();
echo "\nAll users in database:\n";
foreach ($users as $user) {
    echo "  ID: {$user->id}, Email: {$user->email}, Name: {$user->name}\n";
}
