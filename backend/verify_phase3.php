<?php

// Simple database schema verification script
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

echo "=== PHASE 3 DATABASE VERIFICATION ===\n\n";

// Check exam_questions columns
echo "📋 exam_questions Table Columns:\n";
$examQuestionsCols = Schema::getColumns('exam_questions');
$expectedCols = ['id', 'exam_id', 'question_text', 'question_type', 'question_media', 'question_data', 'marks', 'difficulty_level', 'is_required', 'time_limit', 'shuffle_options', 'status', 'max_words', 'marking_rubric', 'created_at', 'updated_at'];

foreach ($examQuestionsCols as $col) {
    $checkmark = in_array($col['name'], $expectedCols) ? '✅' : '❌';
    echo sprintf("%s %-25s %s\n", $checkmark, $col['name'], $col['type']);
}

echo "\n📋 question_options Table Columns:\n";
$optionsCols = Schema::getColumns('question_options');
$expectedOptCols = ['id', 'question_id', 'option_text', 'option_media', 'is_correct', 'order_index', 'created_at', 'updated_at'];

foreach ($optionsCols as $col) {
    $checkmark = in_array($col['name'], $expectedOptCols) ? '✅' : '❌';
    echo sprintf("%s %-25s %s\n", $checkmark, $col['name'], $col['type']);
}

// Check indexes
echo "\n🔑 exam_questions Indexes:\n";
$examIndexes = DB::select("SHOW INDEXES FROM exam_questions");
$indexNames = collect($examIndexes)->pluck('Key_name')->unique()->values();
echo "Indexes found: " . implode(', ', $indexNames->toArray()) . "\n";

echo "\n🔑 question_options Indexes:\n";
$optIndexes = DB::select("SHOW INDEXES FROM question_options");
$optIndexNames = collect($optIndexes)->pluck('Key_name')->unique()->values();
echo "Indexes found: " . implode(', ', $optIndexNames->toArray()) . "\n";

// Check relationships
echo "\n🔗 Foreign Key Relationships:\n";
$fkResults = DB::select("SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME IN ('exam_questions', 'question_options') AND COLUMN_NAME LIKE '%_id'");

foreach ($fkResults as $fk) {
    echo sprintf("✅ %s.%s → %s.%s\n", $fk->TABLE_NAME, $fk->COLUMN_NAME, $fk->REFERENCED_TABLE_NAME, $fk->REFERENCED_COLUMN_NAME);
}

echo "\n✅ PHASE 3 VERIFICATION COMPLETE\n";
