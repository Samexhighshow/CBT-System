<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Spatie\Permission\Models\Role;

echo "Roles in database:\n";
$roles = Role::all();
foreach ($roles as $role) {
  echo "- {$role->name} (guard: {$role->guard_name})\n";
}
echo "\nTotal: " . $roles->count() . " roles\n";
