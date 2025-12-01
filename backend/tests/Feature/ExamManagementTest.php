<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Subject;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ExamManagementTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function admin_can_create_exam()
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $token = $admin->createToken('test-token')->plainTextToken;

        $subject = Subject::factory()->create();

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/exams', [
                'title' => 'Test Exam',
                'subject_id' => $subject->id,
                'duration' => 60,
                'total_marks' => 100,
                'pass_mark' => 40,
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
        $admin->assignRole('admin');
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
