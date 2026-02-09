<?php

use Illuminate\Support\Facades\DB;
use App\Models\User;

// Correct path to autoload - artisan uses ../vendor, so we should too if vendor is in root
require __DIR__ . '/../vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    User::truncate();
    DB::table('model_has_roles')->truncate();
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "Users cleared successfully.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
