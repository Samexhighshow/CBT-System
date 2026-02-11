<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Subject;
use App\Models\SchoolClass;
use Spatie\Permission\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ExamManagementTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function admin_can_create_exam()
    {
        $admin = User::factory()->create();
        $role = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'web']);
        $admin->assignRole($role);
        $token = $admin->createToken('test-token')->plainTextToken;

        $class = SchoolClass::factory()->create();
        $subject = Subject::factory()->create([
            'class_id' => $class->id,
            'class_level' => $class->name,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/exams', [
                'title' => 'Test Exam',
                'subject_id' => $subject->id,
                'class_id' => $class->id,
                'duration_minutes' => 60,
                'assessment_type' => 'Quiz',
                'assessment_weight' => 10,
                'start_time' => now()->addDay()->toDateTimeString(),
                'end_time' => now()->addDays(2)->toDateTimeString(),
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'title',
                'subject_id',
            ]);

        $this->assertDatabaseHas('exams', [
            'title' => 'Test Exam',
        ]);
    }

    /** @test */
    public function exam_can_be_duplicated()
    {
        $admin = User::factory()->create();
        $role = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'web']);
        $admin->assignRole($role);
        $token = $admin->createToken('test-token')->plainTextToken;

        $exam = Exam::factory()->create(['title' => 'Original Exam']);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/exams/{$exam->id}/duplicate", [
                'title' => 'Duplicated Exam',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('exams', [
            'title' => 'Duplicated Exam',
        ]);
    }
}
