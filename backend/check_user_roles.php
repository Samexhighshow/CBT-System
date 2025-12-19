<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\User;

$user = User::with('roles')->where('email', 'isholasamuel062@gmail.com')->first();

if ($user) {
    echo "User: {$user->name}\n";
    echo "Email: {$user->email}\n";
    echo "Roles: " . $user->roles->pluck('name')->implode(', ') . "\n";
    echo "Role IDs: " . $user->roles->pluck('id')->implode(', ') . "\n";
} else {
    echo "User not found\n";
}
?>
