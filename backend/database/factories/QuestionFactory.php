<?php

namespace Database\Factories;

use App\Models\Exam;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionFactory extends Factory
{
    protected $model = Question::class;

    public function definition(): array
    {
        return [
            'exam_id' => Exam::factory(),
            'question_text' => $this->faker->sentence(),
            'question_type' => 'multiple_choice_single',
            'marks' => 1,
            'status' => 'draft',
        ];
    }
}
