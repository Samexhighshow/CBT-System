<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';

// Get database connection
$pdo = \Illuminate\Support\Facades\DB::connection()->getPdo();

echo "=== CHECKING DATABASE STRUCTURE ===\n\n";

// Check all tables
echo "Tables in database:\n";
$tables = $pdo->query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()")->fetchAll(\PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    echo "  - $table\n";
}

echo "\n=== CHECKING SUBJECT AND CLASS RELATIONSHIPS ===\n\n";

// Check subjects table structure
echo "Subjects table structure:\n";
$columns = $pdo->query("DESCRIBE subjects")->fetchAll(\PDO::FETCH_ASSOC);
foreach ($columns as $col) {
    echo "  - {$col['Field']} ({$col['Type']})\n";
}

echo "\n=== CHECKING IF THERE'S A PIVOT TABLE FOR SUBJECT-CLASS ===\n\n";

// Look for pivot tables
$pivotTables = ['class_subject', 'subject_class', 'class_has_subjects', 'subject_class_mapping'];
foreach ($pivotTables as $table) {
    try {
        $exists = $pdo->query("SELECT 1 FROM $table LIMIT 1");
        echo "Found pivot table: $table\n";
        
        $data = $pdo->query("SELECT * FROM $table LIMIT 5")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($data as $row) {
            echo "  " . json_encode($row) . "\n";
        }
    } catch (\Exception $e) {
        // Table doesn't exist
    }
}

echo "\n=== CHECKING ACTUAL DATA IN SUBJECTS TABLE ===\n\n";

echo "First 10 subjects with their class_id:\n";
$subjects = $pdo->query("SELECT id, name, code, class_id FROM subjects ORDER BY id LIMIT 10")->fetchAll(\PDO::FETCH_ASSOC);
foreach ($subjects as $subject) {
    echo "  ID: {$subject['id']}, Name: {$subject['name']}, Class ID: " . ($subject['class_id'] ?? 'NULL') . "\n";
}

echo "\n=== CHECKING WHAT'S IN ACADEMICS MANAGEMENT ===\n\n";

// Check if there's a table for academics management
$academicsTables = ['class_academics', 'academic_setup', 'class_setup', 'academic_class', 'academics'];
foreach ($academicsTables as $table) {
    try {
        $exists = $pdo->query("SELECT 1 FROM $table LIMIT 1");
        echo "\nFound table: $table\n";
        $columns = $pdo->query("DESCRIBE $table")->fetchAll(\PDO::FETCH_ASSOC);
        echo "Columns:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']} ({$col['Type']})\n";
        }
        
        echo "Data:\n";
        $data = $pdo->query("SELECT * FROM $table")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($data as $row) {
            echo "  " . json_encode($row) . "\n";
        }
    } catch (\Exception $e) {
        // Table doesn't exist
    }
}
