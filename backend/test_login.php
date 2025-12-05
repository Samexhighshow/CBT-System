<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'akintunde.dolapo1@gmail.com';
$testPassword = 'password123'; // Replace with the password you're trying to use

$user = User::where('email', $email)->first();

if (!$user) {
    echo "User not found!\n";
    exit;
}

echo "User found: {$user->name}\n";
echo "Email: {$user->email}\n";
echo "Email verified: " . ($user->email_verified_at ? 'Yes' : 'No') . "\n";
echo "\nPassword Hash in DB: {$user->password}\n";

// Test different possible passwords
$possiblePasswords = ['password', 'password123', 'admin123', '12345678'];

echo "\n=== Testing Passwords ===\n";
foreach ($possiblePasswords as $pass) {
    $matches = Hash::check($pass, $user->password);
    echo "Password '{$pass}': " . ($matches ? '✓ MATCHES' : '✗ Does not match') . "\n";
}

echo "\n=== Generate new hash for 'password123' ===\n";
echo "New hash: " . Hash::make('password123') . "\n";

echo "\n=== To fix, run this SQL: ===\n";
$newHash = Hash::make('password123');
echo "UPDATE users SET password = '{$newHash}' WHERE email = '{$email}';\n";
