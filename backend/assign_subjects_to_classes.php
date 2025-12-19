<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\SchoolClass;
use App\Models\Subject;

echo "=== Assigning Subjects to Classes ===\n\n";

// Get classes
$sss1 = SchoolClass::where('name', 'SSS 1')->first();
$jss2 = SchoolClass::where('name', 'JSS 2')->first();

if (!$sss1 || !$jss2) {
    echo "ERROR: Classes not found\n";
    exit(1);
}

echo "Found classes:\n";
echo "  - {$sss1->name} (ID: {$sss1->id})\n";
echo "  - {$jss2->name} (ID: {$jss2->id})\n\n";

// Assign SSS subjects to SSS 1
echo "Assigning SSS subjects to SSS 1 class:\n";
$sssSubjects = Subject::where('class_level', 'SSS')->whereNull('class_id')->get();
foreach ($sssSubjects as $subject) {
    $subject->class_id = $sss1->id;
    $subject->save();
    echo "  ✓ {$subject->name} -> SSS 1\n";
}

// Assign JSS subjects to JSS 2
echo "\nAssigning JSS subjects to JSS 2 class:\n";
$jssSubjects = Subject::where('class_level', 'JSS')->whereNull('class_id')->get();
foreach ($jssSubjects as $subject) {
    $subject->class_id = $jss2->id;
    $subject->save();
    echo "  ✓ {$subject->name} -> JSS 2\n";
}

echo "\n=== Assignment Complete ===\n";
echo "SSS subjects assigned: {$sssSubjects->count()}\n";
echo "JSS subjects assigned: {$jssSubjects->count()}\n";
?>
