<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "🗑️  CLEARING ALL USER DATA...\n\n";

try {
    DB::beginTransaction();

    // Disable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=0');

    // Clear related tables first
    $tables = [
        'personal_access_tokens',
        'model_has_roles',
        'model_has_permissions',
        'password_reset_tokens',
        'failed_jobs',
        'sessions',
    ];

    foreach ($tables as $table) {
        if (Schema::hasTable($table)) {
            $count = DB::table($table)->count();
            DB::table($table)->truncate();
            echo "✓ Cleared {$table}: {$count} records\n";
        }
    }

    // Clear users table
    $userCount = DB::table('users')->count();
    DB::table('users')->truncate();
    echo "✓ Cleared users table: {$userCount} records\n";

    // Reset auto-increment to 1
    DB::statement('ALTER TABLE users AUTO_INCREMENT = 1');
    echo "✓ Reset users table auto-increment to 1\n";

    // Re-enable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=1');

    DB::commit();

    echo "\n✅ SUCCESS! All user data cleared.\n";
    echo "📝 Next user signup will get ID = 1\n";

} catch (\Exception $e) {
    DB::rollBack();
    DB::statement('SET FOREIGN_KEY_CHECKS=1');
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
