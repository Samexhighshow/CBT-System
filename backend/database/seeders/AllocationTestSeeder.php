<?php

namespace Database\Seeders;

use App\Models\Hall;
use App\Models\User;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\Exam;
use Illuminate\Database\Seeder;

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

        // Create test teachers (invigilators)
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

        foreach ($teacherNames as $index => $name) {
            $user = User::updateOrCreate(
                ['email' => 'teacher' . ($index + 1) . '@test.com'],
                [
                    'name' => $name,
                    'password' => bcrypt('password'),
                ]
            );

            Teacher::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'department' => 'General',
                    'specialization' => 'Invigilation',
                ]
            );
        }

        $this->command->info('Created ' . count($teacherNames) . ' test teachers');

        // Create test students across different classes
        $classes = ['Grade 10A', 'Grade 10B', 'Grade 11A', 'Grade 11B', 'Grade 12A', 'Grade 12B'];
        $studentsPerClass = 25;

        $studentCount = 0;
        foreach ($classes as $classIndex => $className) {
            for ($i = 1; $i <= $studentsPerClass; $i++) {
                $studentCount++;
                $user = User::updateOrCreate(
                    ['email' => 'student' . $studentCount . '@test.com'],
                    [
                        'name' => 'Student ' . $studentCount,
                        'password' => bcrypt('password'),
                    ]
                );

                Student::updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'student_id' => 'S' . str_pad($studentCount, 4, '0', STR_PAD_LEFT),
                        'class_level' => $className,
                        'date_of_birth' => now()->subYears(15 + $classIndex),
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
                'exam_date' => now()->addDays(7),
                'duration' => 120,
                'total_marks' => 100,
                'passing_marks' => 40,
                'instructions' => 'This is a test exam for the allocation system.',
                'shuffle_questions' => true,
                'seat_numbering' => 'row_major',
                'enforce_adjacency_rules' => true,
            ]
        );

        // Enroll all students in the exam
        $students = Student::all();
        foreach ($students as $student) {
            $exam->students()->syncWithoutDetaching([$student->id]);
        }

        $this->command->info('Created test exam and enrolled all students');
        $this->command->newLine();
        $this->command->info('=== Test Data Summary ===');
        $this->command->info('Halls: ' . Hall::count());
        $this->command->info('Teachers: ' . Teacher::count());
        $this->command->info('Students: ' . Student::count());
        $this->command->info('Total Capacity: ' . Hall::sum(\DB::raw('rows * columns')));
        $this->command->info('Exam: ' . $exam->title . ' (ID: ' . $exam->id . ')');
        $this->command->newLine();
        $this->command->info('✓ Allocation test data seeded successfully!');
        $this->command->info('You can now test allocation generation at /api/allocations/generate');
    }
}
