<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Exam;

// Test 1: Check if any exams exist
$exams = Exam::limit(3)->get();
echo "=== Test 1: Exams in Database ===\n";
if ($exams->isEmpty()) {
    echo "❌ No exams found in database\n";
} else {
    echo "✅ Found " . $exams->count() . " exam(s)\n";
    foreach ($exams as $exam) {
        echo "  - Exam #{$exam->id}: {$exam->title}\n";
        echo "    Selection Mode: " . ($exam->question_selection_mode ?? 'NULL') . "\n";
        echo "    Difficulty Distribution: " . json_encode($exam->difficulty_distribution) . "\n";
        echo "    Marks Distribution: " . json_encode($exam->marks_distribution) . "\n";
    }
}

// Test 2: Check if questions exist
echo "\n=== Test 2: Questions in Database ===\n";
if ($exams->isNotEmpty()) {
    $exam = $exams->first();
    $qCount = $exam->questions()->count();
    echo "Exam #{$exam->id} has {$qCount} question(s)\n";
    
    if ($qCount > 0) {
        $questions = $exam->questions()->limit(3)->get();
        foreach ($questions as $q) {
            echo "  - Q#{$q->id}: {$q->text} (Marks: {$q->marks}, Difficulty: {$q->difficulty_level})\n";
        }
    }
}

// Test 3: Test updating randomization settings
echo "\n=== Test 3: Update Randomization Settings ===\n";
if ($exams->isNotEmpty()) {
    $exam = $exams->first();
    try {
        $exam->update([
            'question_selection_mode' => 'random',
            'total_questions_to_serve' => 10,
            'shuffle_question_order' => true,
            'shuffle_option_order' => true,
            'question_distribution' => 'same_for_all',
            'difficulty_distribution' => ['easy' => 5, 'medium' => 3, 'hard' => 2],
            'marks_distribution' => [1 => 5, 2 => 3, 5 => 2],
            'question_reuse_policy' => 'allow_reuse',
        ]);
        
        $exam->refresh();
        echo "✅ Settings updated successfully\n";
        echo "   Selection Mode: " . $exam->question_selection_mode . "\n";
        echo "   Difficulty Distribution: " . json_encode($exam->difficulty_distribution) . "\n";
        echo "   Marks Distribution: " . json_encode($exam->marks_distribution) . "\n";
    } catch (\Exception $e) {
        echo "❌ Error updating settings: " . $e->getMessage() . "\n";
    }
}

echo "\n=== All Tests Complete ===\n";
