<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\Exam;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\User;
use Spatie\Permission\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;

class QuestionAdminActionsTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $user;
    protected $exam;

    public function setUp(): void
    {
        parent::setUp();

        $role = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'web']);
        $this->user = User::factory()->create();
        $this->user->assignRole($role);
        $this->exam = Exam::factory()->create();
    }

    /**
     * Test: Duplicate Question
     * 
     * Verifies that:
     * - Question is successfully duplicated
     * - All options are copied
     * - New question has draft status
     * - Question is attached to same exam
     */
    public function test_duplicate_question_successfully(): void
    {
        // Create source question with options
        $question = Question::factory()
            ->for($this->exam)
            ->create([
                'question_type' => 'multiple_choice_single',
                'status' => 'active'
            ]);

        QuestionOption::factory(4)
            ->for($question)
            ->create();

        // Duplicate the question
        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/{$question->id}/duplicate");

        // Assertions
        $this->assertSame(201, $response->getStatusCode(), $response->getContent());
        $response->assertJsonStructure([
            'message',
            'question' => ['id', 'exam_id', 'question_text', 'status'],
            'original_id',
            'new_id'
        ]);

        // Verify new question
        $duplicated = Question::find($response->json('question.id'));
        $this->assertNotNull($duplicated);
        $this->assertEquals($question->exam_id, $duplicated->exam_id);
        $this->assertEquals('draft', $duplicated->status);
        $this->assertEquals($question->question_text, $duplicated->question_text);

        // Verify options were copied
        $this->assertEquals(
            $question->options()->count(),
            $duplicated->options()->count()
        );
    }

    /**
     * Test: Cannot Duplicate Question - Exam Closed
     */
    public function test_cannot_duplicate_question_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $question = Question::factory()
            ->for($closedExam)
            ->create();

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/{$question->id}/duplicate");

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Cannot duplicate questions for a closed exam');
    }

    /**
     * Test: Toggle Question Status
     * 
     * Verifies status transitions:
     * - active → disabled
     * - disabled → active
     * - draft → active
     */
    public function test_toggle_question_status_successfully(): void
    {
        $question = Question::factory()
            ->for($this->exam)
            ->create(['status' => 'active']);

        // Toggle to disabled
        $response = $this->actingAs($this->user)
            ->patchJson("/api/questions/{$question->id}/toggle-status");

        $response->assertStatus(200);
        $response->assertJsonPath('new_status', 'disabled');

        // Verify database
        $this->assertEquals('disabled', $question->fresh()->status);

        // Toggle back to active
        $response = $this->actingAs($this->user)
            ->patchJson("/api/questions/{$question->id}/toggle-status");

        $response->assertStatus(200);
        $response->assertJsonPath('new_status', 'active');
    }

    /**
     * Test: Cannot Toggle Status - Exam Closed
     */
    public function test_cannot_toggle_status_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $question = Question::factory()
            ->for($closedExam)
            ->create(['status' => 'active']);

        $response = $this->actingAs($this->user)
            ->patchJson("/api/questions/{$question->id}/toggle-status");

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Cannot modify questions in a closed exam');
    }

    /**
     * Test: Delete Question
     */
    public function test_delete_question_successfully(): void
    {
        $question = Question::factory()
            ->for($this->exam)
            ->create();

        $questionId = $question->id;

        $response = $this->actingAs($this->user)
            ->deleteJson("/api/questions/{$questionId}");

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Question deleted successfully');
        $response->assertJsonPath('deleted_id', (string)$questionId);

        // Verify deletion
        $this->assertNull(Question::find($questionId));
    }

    /**
     * Test: Cannot Delete Question - Exam Closed
     */
    public function test_cannot_delete_question_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $question = Question::factory()
            ->for($closedExam)
            ->create();

        $response = $this->actingAs($this->user)
            ->deleteJson("/api/questions/{$question->id}");

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Cannot delete questions from a closed exam');
    }

    /**
     * Test: Reorder Questions
     */
    public function test_reorder_questions_successfully(): void
    {
        // Create multiple questions
        $questions = Question::factory(5)
            ->for($this->exam)
            ->create();

        // Prepare reorder payload
        $reorderData = [
            'questions' => [
                ['id' => $questions[4]->id, 'order' => 1],
                ['id' => $questions[3]->id, 'order' => 2],
                ['id' => $questions[2]->id, 'order' => 3],
                ['id' => $questions[1]->id, 'order' => 4],
                ['id' => $questions[0]->id, 'order' => 5],
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/reorder", $reorderData);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Questions reordered successfully');

        // Verify order_index was updated
        $this->assertEquals(1, $questions[4]->fresh()->order_index);
        $this->assertEquals(2, $questions[3]->fresh()->order_index);
        $this->assertEquals(5, $questions[0]->fresh()->order_index);
    }

    /**
     * Test: Cannot Reorder Questions - Exam Closed
     */
    public function test_cannot_reorder_questions_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $questions = Question::factory(3)
            ->for($closedExam)
            ->create();

        $reorderData = [
            'questions' => [
                ['id' => $questions[0]->id, 'order' => 1],
                ['id' => $questions[1]->id, 'order' => 2],
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/reorder", $reorderData);

        $response->assertStatus(422);
    }

    /**
     * Test: Preview Question as Student
     * 
     * Verifies that:
     * - Correct answers are hidden
     * - Admin fields are not shown
     * - Question displays properly for student view
     */
    public function test_preview_question_as_student(): void
    {
        $question = Question::factory()
            ->for($this->exam)
            ->create(['question_type' => 'multiple_choice_single']);

        QuestionOption::factory(4)
            ->for($question)
            ->create();

        $response = $this->actingAs($this->user)
            ->getJson("/api/questions/{$question->id}/preview");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'preview' => [
                'id',
                'question_text',
                'question_type',
                'marks',
                'options' => [
                    '*' => ['id', 'option_text']
                ]
            ],
            'exam' => ['id', 'title']
        ]);

        // Verify is_correct is not in response
        $options = $response->json('preview.options');
        foreach ($options as $option) {
            $this->assertArrayNotHasKey('is_correct', $option);
        }
    }

    /**
     * Test: Bulk Delete Questions
     */
    public function test_bulk_delete_questions_successfully(): void
    {
        $questions = Question::factory(5)
            ->for($this->exam)
            ->create();

        $questionIds = $questions->pluck('id')->toArray();
        $deleteIds = array_slice($questionIds, 0, 3);

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/bulk-delete", [
                'question_ids' => $deleteIds
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('deleted_count', 3);

        // Verify deletion
        foreach ($deleteIds as $id) {
            $this->assertNull(Question::find($id));
        }

        // Verify remaining questions
        $this->assertEquals(2, $this->exam->questions()->count());
    }

    /**
     * Test: Cannot Bulk Delete - Exam Closed
     */
    public function test_cannot_bulk_delete_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $questions = Question::factory(3)
            ->for($closedExam)
            ->create();

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/bulk-delete", [
                'question_ids' => $questions->pluck('id')->toArray()
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test: Bulk Update Question Status
     */
    public function test_bulk_update_status_successfully(): void
    {
        $questions = Question::factory(5)
            ->for($this->exam)
            ->create(['status' => 'active']);

        $questionIds = $questions->pluck('id')->slice(0, 3)->toArray();

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/bulk-status", [
                'question_ids' => $questionIds,
                'status' => 'disabled'
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('updated_count', 3);
        $response->assertJsonPath('new_status', 'disabled');

        // Verify status changed
        foreach ($questionIds as $id) {
            $this->assertEquals('disabled', Question::find($id)->status);
        }
    }

    /**
     * Test: Cannot Bulk Update Status - Exam Closed
     */
    public function test_cannot_bulk_update_status_if_exam_closed(): void
    {
        $closedExam = Exam::factory()
            ->create(['status' => 'closed']);

        $questions = Question::factory(3)
            ->for($closedExam)
            ->create();

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/bulk-status", [
                'question_ids' => $questions->pluck('id')->toArray(),
                'status' => 'disabled'
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test: Group Questions by Type
     */
    public function test_group_questions_by_type(): void
    {
        // Create questions of different types
        Question::factory(3)
            ->for($this->exam)
            ->create(['question_type' => 'multiple_choice_single']);

        Question::factory(2)
            ->for($this->exam)
            ->create(['question_type' => 'essay']);

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/group/by/{$this->exam->id}", [
                'group_by' => 'question_type'
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'exam_id',
            'group_by',
            'groups',
            'total_questions',
            'total_marks'
        ]);

        // Verify groups exist
        $groups = $response->json('groups');
        $this->assertArrayHasKey('multiple_choice_single', $groups);
        $this->assertArrayHasKey('essay', $groups);
        $this->assertEquals(3, $groups['multiple_choice_single']['count']);
        $this->assertEquals(2, $groups['essay']['count']);
    }

    /**
     * Test: Get Exam Statistics
     */
    public function test_get_exam_statistics(): void
    {
        // Create questions with different properties
        Question::factory(3)
            ->for($this->exam)
            ->create([
                'question_type' => 'multiple_choice_single',
                'marks' => 5,
                'difficulty_level' => 'easy'
            ]);

        Question::factory(2)
            ->for($this->exam)
            ->create([
                'question_type' => 'essay',
                'marks' => 10,
                'difficulty_level' => 'hard'
            ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/questions/statistics/exam/{$this->exam->id}");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'exam_id',
            'exam_title',
            'statistics' => [
                'total_questions',
                'total_marks',
                'by_type',
                'by_difficulty',
                'by_status'
            ]
        ]);

        // Verify statistics
        $stats = $response->json('statistics');
        $this->assertEquals(5, $stats['total_questions']);
        $this->assertEquals(35, $stats['total_marks']); // 3*5 + 2*10
    }

    /**
     * Test: Question Not Found
     */
    public function test_error_when_question_not_found(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/questions/99999/preview");

        $response->assertStatus(404);
        $response->assertJsonPath('message', 'Question not found');
    }

    /**
     * Test: Exam Not Found
     */
    public function test_error_when_exam_not_found(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/questions/statistics/exam/99999");

        $response->assertStatus(404);
    }

    /**
     * Test: Invalid Question ID Format
     */
    public function test_error_with_invalid_question_id(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/questions/invalid/preview");

        $response->assertStatus(404);
    }

    /**
     * Test: Reorder with Missing Question IDs
     */
    public function test_error_when_reordering_with_invalid_ids(): void
    {
        $question = Question::factory()
            ->for($this->exam)
            ->create();

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/reorder", [
                'questions' => [
                    ['id' => $question->id, 'order' => 1],
                    ['id' => 99999, 'order' => 2], // Non-existent ID
                ]
            ]);

        $response->assertStatus(422);
    }

    /**
     * Test: Delete Non-existent Question
     */
    public function test_error_when_deleting_nonexistent_question(): void
    {
        $response = $this->actingAs($this->user)
            ->deleteJson("/api/questions/99999");

        $response->assertStatus(404);
    }

    /**
     * Test: Duplicate Multiple Times
     * 
     * Verifies that a question can be duplicated multiple times
     * and each duplicate is independent
     */
    public function test_duplicate_question_multiple_times(): void
    {
        $original = Question::factory()
            ->for($this->exam)
            ->create();

        // Duplicate 3 times
        for ($i = 0; $i < 3; $i++) {
            $response = $this->actingAs($this->user)
                ->postJson("/api/questions/{$original->id}/duplicate");

            $response->assertStatus(201);
        }

        // Verify 3 duplicates exist plus original = 4 total
        $this->assertEquals(4, $this->exam->questions()->count());
    }

    /**
     * Test: Reorder Preserves Question Data
     * 
     * Verifies that reordering doesn't modify question content
     */
    public function test_reorder_preserves_question_data(): void
    {
        $question = Question::factory()
            ->for($this->exam)
            ->create(['question_text' => 'Test question']);

        $original_text = $question->question_text;

        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/reorder", [
                'questions' => [
                    ['id' => $question->id, 'order' => 1],
                ]
            ]);

        $response->assertStatus(200);
        $this->assertEquals($original_text, $question->fresh()->question_text);
    }

    /**
     * Test: Bulk Operations are Atomic
     * 
     * Verifies that bulk operations either complete entirely or rollback
     */
    public function test_bulk_delete_is_atomic(): void
    {
        $questions = Question::factory(3)
            ->for($this->exam)
            ->create();

        $questionIds = $questions->pluck('id')->toArray();
        $initialCount = $this->exam->questions()->count();

        // Try to delete with one invalid ID mixed in
        $response = $this->actingAs($this->user)
            ->postJson("/api/questions/bulk-delete", [
                'question_ids' => array_merge($questionIds, [99999]) // Invalid ID
            ]);

        $response->assertStatus(422);

        // Verify original questions still exist (rollback occurred)
        $this->assertEquals($initialCount, $this->exam->questions()->count());
    }
}
