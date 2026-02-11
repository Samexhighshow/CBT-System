<?php

namespace Database\Factories;

use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Factories\Factory;

class SchoolClassFactory extends Factory
{
    protected $model = SchoolClass::class;

    public function definition(): array
    {
        $level = $this->faker->randomElement(['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3']);
        $suffix = $this->faker->randomElement(['A', 'B', 'C']);
        $uniqueNum = $this->faker->unique()->numberBetween(1, 99);
        $name = $level . $suffix . $uniqueNum;

        return [
            'name' => $name,
            'description' => $this->faker->sentence(),
            'capacity' => $this->faker->numberBetween(20, 60),
            'is_active' => true,
            'metadata' => null,
        ];
    }
}
