<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'akintunde.dolapo1@gmail.com';
$newPassword = 'password123';

$user = User::where('email', $email)->first();

if (!$user) {
    echo "User not found!\n";
    exit;
}

echo "Updating password for: {$user->name} ({$user->email})\n";

$user->password = Hash::make($newPassword);
$user->save();

echo "✓ Password updated successfully!\n";
echo "\nYou can now login with:\n";
echo "Email: {$email}\n";
echo "Password: {$newPassword}\n";

// Verify it works
if (Hash::check($newPassword, $user->password)) {
    echo "\n✓ Password verification successful!\n";
} else {
    echo "\n✗ Password verification failed!\n";
}
