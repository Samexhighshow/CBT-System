<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;
use App\Models\Subject;

class SubjectDepartmentSeeder extends Seeder
{
    public function run()
    {
        // JSS subjects (available to all JSS classes)
        $jssSubjects = [
            ['name' => 'English Language', 'class_level' => 'JSS', 'is_compulsory' => true],
            ['name' => 'Mathematics', 'class_level' => 'JSS', 'is_compulsory' => true],
            ['name' => 'Integrated Science', 'class_level' => 'JSS', 'is_compulsory' => true],
            ['name' => 'Social Studies', 'class_level' => 'JSS', 'is_compulsory' => true],
            ['name' => 'History', 'class_level' => 'JSS', 'is_compulsory' => false],
            ['name' => 'Geography', 'class_level' => 'JSS', 'is_compulsory' => false],
            ['name' => 'Physical Education', 'class_level' => 'JSS', 'is_compulsory' => false],
        ];

        foreach ($jssSubjects as $subject) {
            Subject::firstOrCreate($subject);
        }

        // SSS Departments
        $departments = [
            ['name' => 'Science', 'class_level' => 'SSS'],
            ['name' => 'Arts', 'class_level' => 'SSS'],
            ['name' => 'Commercial', 'class_level' => 'SSS'],
        ];

        foreach ($departments as $dept) {
            Department::firstOrCreate($dept);
        }

        // SSS subjects per department
        $scienceSubjects = [
            ['name' => 'English Language', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Mathematics', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Physics', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Chemistry', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Biology', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Computer Science', 'class_level' => 'SSS', 'is_compulsory' => false],
        ];

        $artsSubjects = [
            ['name' => 'English Language', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Mathematics', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'History', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Government', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Literature in English', 'class_level' => 'SSS', 'is_compulsory' => false],
            ['name' => 'Geography', 'class_level' => 'SSS', 'is_compulsory' => false],
        ];

        $commercialSubjects = [
            ['name' => 'English Language', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Mathematics', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Economics', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Accounting', 'class_level' => 'SSS', 'is_compulsory' => true],
            ['name' => 'Commerce', 'class_level' => 'SSS', 'is_compulsory' => false],
            ['name' => 'Business Studies', 'class_level' => 'SSS', 'is_compulsory' => false],
        ];

        foreach ($scienceSubjects as $subject) {
            Subject::firstOrCreate($subject);
        }
        foreach ($artsSubjects as $subject) {
            Subject::firstOrCreate($subject);
        }
        foreach ($commercialSubjects as $subject) {
            Subject::firstOrCreate($subject);
        }
    }
}
