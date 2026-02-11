<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$email = 'isholasamuel062@gmail.com';
$user = User::where('email', $email)->first();

if (!$user) {
    echo "User not found with email: $email\n";
    echo "Please create the user first via signup.\n";
    exit(1);
}

echo "User found: {$user->name} ({$user->email})\n";
echo "User ID: {$user->id}\n";
echo "Email verified: " . ($user->hasVerifiedEmail() ? 'Yes' : 'No') . "\n";
echo "Roles: " . $user->roles->pluck('name')->join(', ') . "\n";

// Fix: Verify email if not verified
if (!$user->hasVerifiedEmail()) {
    $user->markEmailAsVerified();
    echo "✓ Email verified\n";
}

// Fix: Assign Main Admin role if no roles
if ($user->roles->isEmpty()) {
    $user->assignRole('Main Admin');
    echo "✓ Assigned Main Admin role\n";
    $user->refresh();
    echo "Updated roles: " . $user->roles->pluck('name')->join(', ') . "\n";
} else {
    echo "User already has roles, no changes needed.\n";
}

echo "\nUser is ready to login!\n";
