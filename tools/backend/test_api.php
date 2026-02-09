<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Exam;
use App\Http\Controllers\Api\ExamQuestionRandomizationController;
use Illuminate\Http\Request;

echo "=== RANDOMIZATION API TEST ===\n\n";

// Get first exam
$exam = Exam::find(1);
if (!$exam) {
    echo "❌ No exam found with ID 1\n";
    exit;
}

echo "Testing with Exam: " . $exam->title . " (ID: {$exam->id})\n";
echo "Current Questions: " . $exam->questions()->count() . "\n\n";

// Test 1: Get randomization stats
echo "=== Test 1: Get Randomization Stats ===\n";
try {
    $controller = new ExamQuestionRandomizationController(new \App\Services\QuestionSelectionService());
    $response = $controller->getRandomizationStats($exam->id);
    $data = json_decode($response->getContent(), true);
    
    if ($response->status() === 200) {
        echo "✅ Stats retrieved successfully\n";
        $statsData = $data['data'] ?? $data;
        echo "   Active Questions: " . ($statsData['active_questions'] ?? 'N/A') . "\n";
        echo "   Selection Mode: " . (($statsData['settings']['selection_mode'] ?? null) ?: 'NOT SET') . "\n";
    } else {
        echo "❌ Failed to get stats\n";
    }
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

// Test 2: Update randomization settings
echo "\n=== Test 2: Update Randomization Settings ===\n";
try {
    $request = new Request([
        'question_selection_mode' => 'random',
        'total_questions_to_serve' => 10,
        'shuffle_question_order' => true,
        'shuffle_option_order' => false,
        'question_distribution' => 'same_for_all',
        'difficulty_distribution' => [
            'easy' => 3,
            'medium' => 5,
            'hard' => 2
        ],
        'question_reuse_policy' => 'allow_reuse',
    ]);
    
    $controller = new ExamQuestionRandomizationController(new \App\Services\QuestionSelectionService());
    $response = $controller->updateRandomizationSettings($request, $exam->id);
    $data = json_decode($response->getContent(), true);
    
    if ($response->status() === 200) {
        echo "✅ Settings updated successfully\n";
        $exam->refresh();
        echo "   Selection Mode: " . $exam->question_selection_mode . "\n";
        echo "   Total to Serve: " . $exam->total_questions_to_serve . "\n";
        echo "   Difficulty Distribution: " . json_encode($exam->difficulty_distribution) . "\n";
    } else {
        echo "❌ Failed to update settings\n";
        echo "   Error: " . ($data['message'] ?? 'Unknown error') . "\n";
        if (isset($data['errors'])) {
            foreach ($data['errors'] as $field => $errors) {
                echo "   {$field}: " . implode(', ', $errors) . "\n";
            }
        }
    }
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

// Test 3: Get updated stats
echo "\n=== Test 3: Verify Updated Stats ===\n";
try {
    $controller = new ExamQuestionRandomizationController(new \App\Services\QuestionSelectionService());
    $response = $controller->getRandomizationStats($exam->id);
    $data = json_decode($response->getContent(), true);
    
    if ($response->status() === 200) {
        echo "✅ Updated stats retrieved\n";
        $statsData = $data['data'] ?? $data;
        echo "   Selection Mode: " . $statsData['settings']['selection_mode'] . "\n";
        echo "   Total to Serve: " . $statsData['settings']['total_to_serve'] . "\n";
        echo "   Shuffle Questions: " . ($statsData['settings']['shuffle_questions'] ? 'Yes' : 'No') . "\n";
        echo "   Difficulty Distribution: " . json_encode($statsData['settings']['difficulty_distribution']) . "\n";
    }
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

// Test 4: Test null/empty distribution handling
echo "\n=== Test 4: Test Null Distribution Handling ===\n";
try {
    $request = new Request([
        'question_selection_mode' => 'random',
        'total_questions_to_serve' => 5,
        'difficulty_distribution' => null,
        'marks_distribution' => null,
    ]);
    
    $controller = new ExamQuestionRandomizationController(new \App\Services\QuestionSelectionService());
    $response = $controller->updateRandomizationSettings($request, $exam->id);
    
    if ($response->status() === 200) {
        echo "✅ Null distributions handled correctly\n";
    } else {
        echo "❌ Null handling failed\n";
    }
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

// Test 5: Test marks distribution
echo "\n=== Test 5: Test Marks Distribution ===\n";
try {
    $request = new Request([
        'question_selection_mode' => 'random',
        'total_questions_to_serve' => 10,
        'marks_distribution' => [
            ['marks' => 1, 'count' => 5],
            ['marks' => 2, 'count' => 3],
            ['marks' => 5, 'count' => 2],
        ],
    ]);
    
    $controller = new ExamQuestionRandomizationController(new \App\Services\QuestionSelectionService());
    $response = $controller->updateRandomizationSettings($request, $exam->id);
    $data = json_decode($response->getContent(), true);
    
    if ($response->status() === 200) {
        echo "✅ Marks distribution saved correctly\n";
        $exam->refresh();
        echo "   Marks Distribution: " . json_encode($exam->marks_distribution) . "\n";
    } else {
        echo "❌ Failed to update marks distribution\n";
        if (isset($data['errors'])) {
            foreach ($data['errors'] as $field => $errors) {
                echo "   {$field}: " . implode(', ', $errors) . "\n";
            }
        }
    }
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== ALL API TESTS COMPLETE ===\n";
