<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Exam;

// Unlock all exams for testing
$exams = Exam::all();
foreach ($exams as $exam) {
    $exam->update([
        'questions_locked' => false,
        'questions_locked_at' => null,
    ]);
    echo "✅ Unlocked exam {$exam->id}: {$exam->title}\n";
}

echo "\nAll exams unlocked for testing\n";
