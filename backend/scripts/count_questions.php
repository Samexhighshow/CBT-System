<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Question;

$examIds = [6, 7];
foreach ($examIds as $examId) {
    $count = Question::where('exam_id', $examId)->count();
    echo "Exam {$examId}: {$count} questions" . PHP_EOL;
}
