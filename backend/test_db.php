<?php

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$db = app('db');

try {
    $result = $db->select('SELECT 1');
    echo "✓ DB Connection: OK\n";
} catch (Exception $e) {
    echo "✗ DB Error: " . $e->getMessage() . "\n";
    exit(1);
}

// Check if cbt_system database exists
try {
    $databases = $db->select("SHOW DATABASES LIKE 'cbt_system'");
    if (count($databases) > 0) {
        echo "✓ Database 'cbt_system' exists\n";
    } else {
        echo "✗ Database 'cbt_system' NOT found\n";
        exit(1);
    }
} catch (Exception $e) {
    echo "✗ Error checking databases: " . $e->getMessage() . "\n";
    exit(1);
}

// Check tables
try {
    $tables = $db->select("SHOW TABLES");
    echo "✓ Tables in cbt_system: " . count($tables) . "\n";
    foreach ($tables as $table) {
        $tableName = (array)$table;
        echo "  - " . reset($tableName) . "\n";
    }
} catch (Exception $e) {
    echo "✗ Error listing tables: " . $e->getMessage() . "\n";
}
