<?php

namespace Database\Factories;

use App\Models\SchoolClass;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubjectFactory extends Factory
{
    protected $model = Subject::class;

    public function definition(): array
    {
        return [
            'name' => ucfirst($this->faker->unique()->word()),
            'code' => strtoupper($this->faker->unique()->lexify('SUB???')),
            'description' => $this->faker->sentence(),
            'is_compulsory' => $this->faker->boolean(),
            'class_id' => SchoolClass::factory(),
            'class_level' => function (array $attributes) {
                $classId = $attributes['class_id'] instanceof SchoolClass
                    ? $attributes['class_id']->id
                    : $attributes['class_id'];
                $class = SchoolClass::find($classId);
                return $class ? $class->name : 'JSS1';
            },
            'department_id' => null,
            'subject_type' => 'core',
            'is_active' => true,
        ];
    }
}
