<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = App\Models\User::with('roles')->get();
echo sprintf("%-4s | %-30s | %-20s | %-12s | %s\n", "ID", "Email", "Name", "Verified", "Roles");
echo str_repeat("-", 90) . "\n";
foreach ($users as $u) {
    $verified = $u->email_verified_at ? 'YES' : 'NO';
    $roles = $u->roles->pluck('name')->join(', ') ?: '(none)';
    echo sprintf("%-4d | %-30s | %-20s | %-12s | %s\n", $u->id, $u->email, $u->name, $verified, $roles);
}
