<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Option;

class ExamSeeder extends Seeder
{
    public function run()
    {
        // Create a sample exam for JSS1
        $exam = Exam::firstOrCreate([
            'title' => 'JSS1 English Language Quiz',
            'class_level' => 'JSS',
            'department' => null,
            'duration_minutes' => 30,
        ], [
            'description' => 'Sample quiz for JSS1 students to test the exam system.',
            'published' => true,
            'metadata' => [
                'negative_marking' => false,
                'partial_credit' => false
            ]
        ]);

        // Create sample questions
        $question1 = Question::firstOrCreate([
            'exam_id' => $exam->id,
            'question_text' => 'What is the past tense of "eat"?',
            'question_type' => 'mcq'
        ]);

        Option::firstOrCreate([
            'question_id' => $question1->id,
            'option_text' => 'ate',
            'is_correct' => true
        ]);
        Option::firstOrCreate([
            'question_id' => $question1->id,
            'option_text' => 'eating',
            'is_correct' => false
        ]);
        Option::firstOrCreate([
            'question_id' => $question1->id,
            'option_text' => 'eats',
            'is_correct' => false
        ]);
        Option::firstOrCreate([
            'question_id' => $question1->id,
            'option_text' => 'eaten',
            'is_correct' => false
        ]);

        // Create a sample exam for SSS Science
        $examSci = Exam::firstOrCreate([
            'title' => 'SSS1 Physics Test',
            'class_level' => 'SSS',
            'department' => 'Science',
            'duration_minutes' => 60,
        ], [
            'description' => 'Physics test for SSS1 Science students.',
            'published' => true
        ]);

        $question2 = Question::firstOrCreate([
            'exam_id' => $examSci->id,
            'question_text' => 'What is the SI unit of force?',
            'question_type' => 'mcq'
        ]);

        Option::firstOrCreate([
            'question_id' => $question2->id,
            'option_text' => 'Newton',
            'is_correct' => true
        ]);
        Option::firstOrCreate([
            'question_id' => $question2->id,
            'option_text' => 'Joule',
            'is_correct' => false
        ]);
        Option::firstOrCreate([
            'question_id' => $question2->id,
            'option_text' => 'Watt',
            'is_correct' => false
        ]);
        Option::firstOrCreate([
            'question_id' => $question2->id,
            'option_text' => 'Pascal',
            'is_correct' => false
        ]);
    }
}
