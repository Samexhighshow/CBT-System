<?php

require 'vendor/autoload.php';

$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$user = User::where('email', 'isholasamuel062@gmail.com')->first();

if (!$user) {
    echo "User not found\n";
    exit(1);
}

echo "✓ User found: " . $user->name . "\n";
echo "  Email: " . $user->email . "\n";
echo "  Email verified: " . ($user->email_verified_at ? 'Yes' : 'No') . "\n";

if (Hash::check('Samex1122', $user->password)) {
    echo "✓ Password matches\n";
    $token = $user->createToken('api')->plainTextToken;
    echo "✓ Token generated: " . substr($token, 0, 20) . "...\n";
} else {
    echo "✗ Password does not match\n";
}
