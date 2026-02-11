<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'isholasamuel062@gmail.com';
$newPassword = 'Callmelater';

$user = User::where('email', $email)->first();

if (!$user) {
    echo "User not found with email: $email\n";
    exit(1);
}

$user->password = Hash::make($newPassword);
$user->save();

echo "✓ Password updated for: {$user->name} ({$user->email})\n";
echo "New password: $newPassword\n";
echo "\nYou can now login with:\n";
echo "Email: $email\n";
echo "Password: $newPassword\n";
