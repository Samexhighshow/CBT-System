<?php

require 'vendor/autoload.php';

$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use Carbon\Carbon;

$user = User::where('email', 'isholasamuel062@gmail.com')->first();

if ($user) {
    $user->update(['email_verified_at' => Carbon::now()]);
    echo "✓ Email verified for: " . $user->email . "\n";
} else {
    echo "✗ User not found\n";
}
