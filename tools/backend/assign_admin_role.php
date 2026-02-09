<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\User;
use Spatie\Permission\Models\Role;

echo "=== Assigning Admin Role ===\n";

// Get or create Main Admin role
$mainAdminRole = Role::firstOrCreate(['name' => 'Main Admin', 'guard_name' => 'web']);
echo "Main Admin role ID: {$mainAdminRole->id}\n";

// Get user
$user = User::where('email', 'isholasamuel062@gmail.com')->first();

if (!$user) {
    echo "ERROR: User not found!\n";
    exit(1);
}

echo "User found: {$user->name} ({$user->email})\n";

// Remove all existing roles
$user->syncRoles([]);
echo "Cleared existing roles\n";

// Assign Main Admin role
$user->assignRole('Main Admin');
echo "Assigned 'Main Admin' role\n";

// Verify
$user->refresh();
$user->load('roles');
echo "\nCurrent roles: " . $user->roles->pluck('name')->implode(', ') . "\n";
echo "Role check - hasRole('Main Admin'): " . ($user->hasRole('Main Admin') ? 'YES' : 'NO') . "\n";

echo "\n=== Complete ===\n";
?>
