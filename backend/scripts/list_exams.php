<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Exam;
$exams = Exam::select('id','title')->orderBy('id')->get();
foreach ($exams as $e) {
    echo $e->id . "\t" . ($e->title ?? '') . "\n";
}
