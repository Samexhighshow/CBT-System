<?php
require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Http\Kernel')->handle(
    $request = \Illuminate\Http\Request::capture()
);

use App\Models\User;
use Illuminate\Support\Facades\Hash;

echo "=== User Database Check ===\n";
$user = User::where('email', 'isholasamuel062@gmail.com')->first();

if (!$user) {
    echo "ERROR: User not found in database!\n";
    exit(1);
}

echo "User found:\n";
echo "  ID: {$user->id}\n";
echo "  Name: {$user->name}\n";
echo "  Email: {$user->email}\n";
echo "  Email Verified: " . ($user->hasVerifiedEmail() ? 'YES' : 'NO') . "\n";
echo "  Password Hash: " . substr($user->password, 0, 20) . "...\n";

echo "\n=== Password Hash Test ===\n";
$plainPassword = 'Samex1122';
$isPasswordValid = Hash::check($plainPassword, $user->password);
echo "Password '{$plainPassword}' valid: " . ($isPasswordValid ? 'YES' : 'NO') . "\n";

if (!$isPasswordValid) {
    echo "\nTrying to verify with bcrypt directly...\n";
    $testHash = password_hash($plainPassword, PASSWORD_BCRYPT);
    echo "Test hash: " . substr($testHash, 0, 30) . "...\n";
    echo "Stored hash: " . substr($user->password, 0, 30) . "...\n";
}

echo "\n=== Testing Auth::attempt ===\n";
$credentials = [
    'email' => 'isholasamuel062@gmail.com',
    'password' => 'Samex1122'
];

$attemptResult = \Illuminate\Support\Facades\Auth::attempt($credentials);
echo "Auth::attempt result: " . ($attemptResult ? 'SUCCESS' : 'FAILED') . "\n";

if (!$attemptResult) {
    echo "\nDEBUG: Checking provider...\n";
    echo "Auth default guard: " . \Illuminate\Support\Facades\Auth::getDefaultDriver() . "\n";
}
?>
