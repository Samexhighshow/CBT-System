<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CbtSubject;
use App\Models\User;

class CbtSubjectSeeder extends Seeder
{
    public function run()
    {
        // Get first admin user as owner
        $admin = User::role(['Main Admin', 'Admin'])->first();
        
        if (!$admin) {
            $this->command->warn('No admin user found. Please create an admin account first.');
            return;
        }

        $subjects = [
            // JSS Subjects
            [
                'subject_name' => 'Mathematics',
                'class_level' => 'JSS 1',
                'description' => 'Junior Secondary School Mathematics',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'English Language',
                'class_level' => 'JSS 1',
                'description' => 'Junior Secondary School English',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'Integrated Science',
                'class_level' => 'JSS 1',
                'description' => 'Junior Secondary School Science',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            
            // SSS Subjects
            [
                'subject_name' => 'Physics',
                'class_level' => 'SSS 1',
                'description' => 'Senior Secondary School Physics',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'Chemistry',
                'class_level' => 'SSS 1',
                'description' => 'Senior Secondary School Chemistry',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'Biology',
                'class_level' => 'SSS 1',
                'description' => 'Senior Secondary School Biology',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'Mathematics',
                'class_level' => 'SSS 1',
                'description' => 'Senior Secondary School Mathematics',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
            [
                'subject_name' => 'English Language',
                'class_level' => 'SSS 1',
                'description' => 'Senior Secondary School English',
                'shuffle_questions' => true,
                'questions_required' => 40,
                'total_marks' => 100,
                'duration_minutes' => 60,
                'owner_id' => $admin->id,
            ],
        ];

        foreach ($subjects as $subject) {
            CbtSubject::firstOrCreate(
                [
                    'subject_name' => $subject['subject_name'],
                    'class_level' => $subject['class_level'],
                ],
                $subject
            );
        }

        $this->command->info('CBT subjects seeded successfully!');
    }
}
