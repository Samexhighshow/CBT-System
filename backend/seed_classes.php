<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\SchoolClass;

echo "Creating sample classes...\n\n";

$classes = [
  ['name' => 'JSS 1', 'description' => 'Junior Secondary School 1', 'capacity' => 40, 'is_active' => true],
  ['name' => 'JSS 2', 'description' => 'Junior Secondary School 2', 'capacity' => 40, 'is_active' => true],
  ['name' => 'JSS 3', 'description' => 'Junior Secondary School 3', 'capacity' => 40, 'is_active' => true],
  ['name' => 'SSS 1', 'description' => 'Senior Secondary School 1', 'capacity' => 35, 'is_active' => true],
  ['name' => 'SSS 2', 'description' => 'Senior Secondary School 2', 'capacity' => 35, 'is_active' => true],
  ['name' => 'SSS 3', 'description' => 'Senior Secondary School 3', 'capacity' => 35, 'is_active' => true],
];

foreach ($classes as $classData) {
  $class = SchoolClass::firstOrCreate(
    ['name' => $classData['name']],
    $classData
  );
  echo "✓ {$class->name}\n";
}

echo "\nDone! Created " . count($classes) . " classes.\n";
echo "Total classes in DB: " . SchoolClass::count() . "\n";
