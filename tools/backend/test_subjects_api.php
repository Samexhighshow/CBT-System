<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TESTING SUBJECTS API ENDPOINT ===\n\n";

// Test 1: Get all subjects
echo "1. Getting all subjects:\n";
$allSubjects = App\Models\Subject::all();
echo "Total subjects: " . $allSubjects->count() . "\n\n";

// Test 2: Get subjects filtered by class_level
echo "2. Getting subjects for class_level 'SSS 1':\n";
$sss1Subjects = App\Models\Subject::where('class_level', 'SSS 1')->get();
echo "Total for SSS 1 (by class_level): " . $sss1Subjects->count() . "\n";
foreach ($sss1Subjects->take(5) as $subject) {
    echo "  - {$subject->name} (ID: {$subject->id}, class_id: {$subject->class_id})\n";
}

echo "\n3. Getting subjects filtered by class_id '1':\n";
$class1Subjects = App\Models\Subject::where('class_id', 1)->get();
echo "Total for class_id 1: " . $class1Subjects->count() . "\n";
foreach ($class1Subjects->take(5) as $subject) {
    echo "  - {$subject->name} (ID: {$subject->id}, class_level: {$subject->class_level})\n";
}

echo "\n4. Getting subjects for class_level 'JSS 2':\n";
$jss2Subjects = App\Models\Subject::where('class_level', 'JSS 2')->get();
echo "Total for JSS 2 (by class_level): " . $jss2Subjects->count() . "\n";
foreach ($jss2Subjects->take(5) as $subject) {
    echo "  - {$subject->name} (ID: {$subject->id}, class_id: {$subject->class_id})\n";
}

echo "\n5. Checking class_level values in database:\n";
$classLevels = App\Models\Subject::distinct('class_level')->pluck('class_level');
foreach ($classLevels as $level) {
    $count = App\Models\Subject::where('class_level', $level)->count();
    echo "  - {$level}: {$count} subjects\n";
}

echo "\n6. Checking classes by name:\n";
$classes = App\Models\SchoolClass::all();
foreach ($classes as $class) {
    echo "  - {$class->name} (ID: {$class->id})\n";
}
