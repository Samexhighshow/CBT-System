<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$count = DB::table('users')->count();
echo "Total users in database: {$count}\n";

if ($count === 0) {
    echo "✅ Users table is empty! Next signup will get ID = 1\n";
} else {
    echo "⚠️  Users still exist:\n";
    $users = DB::table('users')->select('id', 'name', 'email')->get();
    foreach ($users as $user) {
        echo "  - ID {$user->id}: {$user->name} ({$user->email})\n";
    }
}
