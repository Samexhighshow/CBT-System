<?php

use Illuminate\Support\Facades\DB;
use App\Models\User;

// Require autoload
require __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    DB::table('users')->truncate();
    DB::table('model_has_roles')->truncate(); // Also clear role assignments
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "Users table cleared successfully.\n";
} catch (\Exception $e) {
    echo "Error clearing users table: " . $e->getMessage() . "\n";
}
