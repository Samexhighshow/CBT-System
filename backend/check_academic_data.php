<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Department;
use App\Models\SchoolClass;
use App\Models\Subject;

echo "=== Academic Data Status ===\n\n";

echo "Departments: " . Department::count() . "\n";
if (Department::count() > 0) {
    echo "Sample: " . Department::first()->name . "\n";
}

echo "\nClasses: " . SchoolClass::count() . "\n";
if (SchoolClass::count() > 0) {
    echo "Sample: " . SchoolClass::first()->name . "\n";
}

echo "\nSubjects: " . Subject::count() . "\n";
if (Subject::count() > 0) {
    echo "Sample: " . Subject::first()->name . "\n";
}

echo "\n=== Summary ===\n";
if (Department::count() === 0 && SchoolClass::count() === 0 && Subject::count() === 0) {
    echo "❌ No academic data found. You need to run seeders or add data manually.\n";
} else {
    echo "✓ Some academic data exists.\n";
}
