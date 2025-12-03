<?php

namespace Database\Seeders;

use App\Models\Hall;
use App\Models\User;
use App\Models\Student;
use App\Models\Exam;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\DB;

class AllocationTestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Seeding allocation test data...');

        // Create test halls
        $halls = [
            ['name' => 'Main Hall A', 'rows' => 10, 'columns' => 8, 'teachers_needed' => 3],
            ['name' => 'Main Hall B', 'rows' => 12, 'columns' => 10, 'teachers_needed' => 4],
            ['name' => 'Science Lab 1', 'rows' => 6, 'columns' => 6, 'teachers_needed' => 2],
            ['name' => 'Computer Lab', 'rows' => 8, 'columns' => 8, 'teachers_needed' => 2],
            ['name' => 'Auditorium', 'rows' => 15, 'columns' => 12, 'teachers_needed' => 5],
        ];

        foreach ($halls as $hallData) {
            Hall::updateOrCreate(
                ['name' => $hallData['name']],
                [
                    'rows' => $hallData['rows'],
                    'columns' => $hallData['columns'],
                    'teachers_needed' => $hallData['teachers_needed'],
                    'notes' => 'Automated test hall',
                    'is_active' => true,
                ]
            );
        }

        $this->command->info('Created ' . count($halls) . ' test halls');

        // Ensure teacher role exists
        $teacherRole = Role::firstOrCreate(['name' => 'teacher']);

        // Create test teachers (invigilators) - Users with teacher role
        $teacherNames = [
            'Dr. John Smith',
            'Prof. Sarah Johnson',
            'Mr. Michael Brown',
            'Mrs. Emily Davis',
            'Dr. James Wilson',
            'Ms. Jennifer Martinez',
            'Mr. Robert Anderson',
            'Dr. Linda Taylor',
            'Prof. David Thomas',
            'Mrs. Patricia Moore',
        ];

        $teacherCount = 0;
        foreach ($teacherNames as $index => $name) {
            $user = User::updateOrCreate(
                ['email' => 'teacher' . ($index + 1) . '@test.com'],
                [
                    'name' => $name,
                    'password' => bcrypt('password'),
                ]
            );

            // Assign teacher role
            if (!$user->hasRole('teacher')) {
                $user->assignRole('teacher');
            }
            
            $teacherCount++;
        }

        $this->command->info('Created ' . $teacherCount . ' test teachers');

        // Ensure student role exists
        $studentRole = Role::firstOrCreate(['name' => 'student']);

        // Create test students across different classes
        $classes = ['Grade 10A', 'Grade 10B', 'Grade 11A', 'Grade 11B', 'Grade 12A', 'Grade 12B'];
        $studentsPerClass = 25;

        $studentCount = 0;
        foreach ($classes as $classIndex => $className) {
            for ($i = 1; $i <= $studentsPerClass; $i++) {
                $studentCount++;
                
                // Create student record
                $student = Student::updateOrCreate(
                    ['email' => 'student' . $studentCount . '@test.com'],
                    [
                        'student_id' => 'S' . str_pad($studentCount, 4, '0', STR_PAD_LEFT),
                        'first_name' => 'Student',
                        'last_name' => (string)$studentCount,
                        'email' => 'student' . $studentCount . '@test.com',
                        'class_level' => $className,
                        'is_active' => true,
                    ]
                );
            }
        }

        $this->command->info('Created ' . $studentCount . ' test students across ' . count($classes) . ' classes');

        // Create a test exam
        $exam = Exam::updateOrCreate(
            ['title' => 'Mid-Term Mathematics Exam'],
            [
                'description' => 'Test exam for allocation engine',
                'class_level' => 'Grade 10',
                'department' => 'General',
                'duration_minutes' => 120,
                'published' => true,
                'metadata' => json_encode([
                    'instructions' => 'This is a test exam for the allocation system.',
                    'total_marks' => 100,
                    'passing_marks' => 40,
                ]),
            ]
        );

        // Note: Since students table doesn't have user relationships for enrollment,
        // we'll skip the enrollment step for now
        // The exam is created and can be used for allocation testing via API

        $this->command->info('Created test exam');
        $this->command->newLine();
        $this->command->info('=== Test Data Summary ===');
        $this->command->info('Halls: ' . Hall::count());
        $this->command->info('Teachers: ' . User::role('teacher')->count());
        $this->command->info('Students: ' . Student::count());
        
        // Calculate total capacity
        $totalCapacity = Hall::all()->sum(function($hall) {
            return $hall->rows * $hall->columns;
        });
        $this->command->info('Total Capacity: ' . $totalCapacity);
        
        $this->command->info('Exam: ' . $exam->title . ' (ID: ' . $exam->id . ')');
        $this->command->newLine();
        $this->command->info('✓ Allocation test data seeded successfully!');
        $this->command->info('You can now test allocation generation at /api/allocations/generate');
    }
}
