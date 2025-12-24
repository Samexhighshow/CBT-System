<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== CHECKING CLASSES AND SUBJECTS IN DATABASE ===\n\n";

// Get all classes with their subjects
$classes = App\Models\SchoolClass::with('subjects')->get();

echo "Total Classes: " . $classes->count() . "\n\n";

foreach ($classes as $class) {
    echo "Class: {$class->name} (ID: {$class->id})\n";
    echo "Number of Subjects: " . $class->subjects->count() . "\n";
    
    if ($class->subjects->count() > 0) {
        echo "Subjects:\n";
        foreach ($class->subjects as $subject) {
            echo "  - {$subject->name} (ID: {$subject->id}, class_id: {$subject->class_id})\n";
        }
    } else {
        echo "  No subjects assigned to this class!\n";
    }
    echo "\n";
}

echo "--- ALL SUBJECTS IN DATABASE ---\n";
$allSubjects = App\Models\Subject::all();
echo "Total Subjects: " . $allSubjects->count() . "\n\n";

foreach ($allSubjects as $subject) {
    $className = $subject->schoolClass ? $subject->schoolClass->name : 'No Class';
    echo "- {$subject->name} (ID: {$subject->id}) -> Class: {$className} (class_id: {$subject->class_id})\n";
}
