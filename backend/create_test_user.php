<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;

$email = 'isholesmauel062@gmail.com';
$password = 'Callmelater';

// Check if user exists
$user = User::where('email', $email)->first();

if ($user) {
    echo "User exists.\n";
    $user->password = Hash::make($password);
    if (!$user->hasVerifiedEmail()) {
        echo "Verifying email...\n";
        $user->markEmailAsVerified();
    }
    $user->save();
} else {
    echo "Creating user...\n";
    $user = User::create([
        'name' => 'Test Student',
        'email' => $email,
        'password' => Hash::make($password),
    ]);
    $user->markEmailAsVerified();
}

// Ensure Student role exists
if (!Role::where('name', 'Student')->exists()) {
    Role::create(['name' => 'Student']);
}

// Assign role
if (!$user->hasRole('Student')) {
    echo "Assigning Student role...\n";
    $user->assignRole('Student');
}

echo "✅ User setup complete & Verified.\n";
