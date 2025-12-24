<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Http\Kernel');

echo "=== TESTING API ENDPOINT /api/classes/1 ===\n\n";

// Simulate the API call
$class = App\Models\SchoolClass::with('students', 'subjects')
    ->withCount('students')
    ->findOrFail(1);

echo "Response structure:\n";
echo json_encode($class, JSON_PRETTY_PRINT);
echo "\n\n";

echo "Subjects count: " . $class->subjects->count() . "\n";
echo "Subjects array:\n";
foreach ($class->subjects as $subject) {
    echo "  - {$subject->name} (ID: {$subject->id})\n";
}
