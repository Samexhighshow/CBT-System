<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Controllers\Api\QuestionController;
use App\Models\Exam;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\SchoolClass;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

$class = SchoolClass::factory()->create();
$subject = Subject::factory()->create([
    'class_id' => $class->id,
    'class_level' => $class->name,
]);

$column = DB::select("SHOW COLUMNS FROM exam_questions LIKE 'bank_question_id'");
echo "bank_question_id column:\n";
print_r($column);

$exam = Exam::factory()->create([
    'subject_id' => $subject->id,
    'class_id' => $class->id,
    'class_level_id' => $class->id,
    'class_level' => $class->name,
]);

$question = Question::factory()->for($exam)->create();
QuestionOption::factory(2)->for($question)->create();

$controller = app(QuestionController::class);
$request = Request::create("/api/questions/{$question->id}/duplicate", 'POST');

$response = $controller->duplicate($request, $question->id);

echo "Status: " . $response->getStatusCode() . PHP_EOL;
echo $response->getContent() . PHP_EOL;
