<?php

namespace Database\Factories;

use App\Models\Exam;
use App\Models\SchoolClass;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExamFactory extends Factory
{
    protected $model = Exam::class;

    public function definition(): array
    {
        return [
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->sentence(),
            'class_id' => SchoolClass::factory(),
            'class_level_id' => function (array $attributes) {
                return $attributes['class_id'] instanceof SchoolClass
                    ? $attributes['class_id']->id
                    : $attributes['class_id'];
            },
            'class_level' => function (array $attributes) {
                $classId = $attributes['class_id'] instanceof SchoolClass
                    ? $attributes['class_id']->id
                    : $attributes['class_id'];
                $class = SchoolClass::find($classId);
                return $class ? $class->name : 'JSS1';
            },
            'subject_id' => function (array $attributes) {
                $classId = $attributes['class_id'] instanceof SchoolClass
                    ? $attributes['class_id']->id
                    : $attributes['class_id'];
                $class = SchoolClass::find($classId);
                $className = $class ? $class->name : 'JSS1';

                return Subject::factory()->create([
                    'class_id' => $classId,
                    'class_level' => $className,
                ])->id;
            },
            'duration_minutes' => 60,
            'status' => 'draft',
            'published' => false,
            'metadata' => [],
        ];
    }
}
