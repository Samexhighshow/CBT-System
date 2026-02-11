<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$email = 'isholesmauel062@gmail.com';
echo "Searching for user with email: $email\n";

$user = User::where('email', $email)->first();

if ($user) {
    echo "✅ User FOUND!\n";
    echo "ID: " . $user->id . "\n";
    echo "Name: " . $user->name . "\n";
    echo "Email: " . $user->email . "\n";
    // Check roles
    if ($user->roles->isEmpty()) {
        echo "Roles: NONE (Pending Approval?)\n";
    } else {
        echo "Roles: " . $user->roles->pluck('name')->implode(', ') . "\n";
    }
} else {
    echo "❌ User NOT FOUND for exact email.\n";

    // Check similar
    $similar = User::where('email', 'LIKE', '%isholesmauel%')->get();
    if ($similar->count() > 0) {
        echo "Found similar users:\n";
        foreach ($similar as $u) {
            echo "- " . $u->email . " (ID: " . $u->id . ")\n";
        }
    } else {
        echo "No similar emails found either.\n";
    }
}
