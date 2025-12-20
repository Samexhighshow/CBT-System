<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\Exam;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;

class QuestionValidationTest extends TestCase
{
    use RefreshDatabase;

    protected $exam;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test exam
        $this->exam = Exam::create([
            'title' => 'Test Exam',
            'description' => 'Test Description',
            'subject_id' => 1,
            'class_id' => 1,
            'duration_minutes' => 60,
            'total_marks' => 100,
            'status' => 'draft',
            'published' => false,
        ]);
    }

    /**
     * Test: Prevent adding questions to closed exam
     */
    public function test_cannot_add_question_to_closed_exam()
    {
        // Close the exam
        $this->exam->update(['status' => 'closed']);

        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => true],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.exam_id.0', 'Cannot add questions to a closed exam');
    }

    /**
     * Test: Validate exam_id exists
     */
    public function test_cannot_add_question_with_invalid_exam_id()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => 99999,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => true],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.exam_id.0', 'The selected exam does not exist');
    }

    /**
     * Test: Marks cannot exceed exam total marks
     */
    public function test_marks_cannot_exceed_exam_total()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 150, // Exceeds total_marks of 100
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => true],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.marks.0', 'Marks cannot exceed exam total marks (100)');
    }

    /**
     * Test: MCQ must have at least 2 options
     */
    public function test_mcq_requires_minimum_options()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'Paris', 'is_correct' => true], // Only 1 option
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.options.0', 'Multiple choice questions must have at least 2 options');
    }

    /**
     * Test: Single answer MCQ must have exactly 1 correct option
     */
    public function test_single_mcq_requires_exactly_one_correct()
    {
        // Case 1: No correct options
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => false],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.options.0', 'Multiple choice (single answer) must have exactly 1 correct option');

        // Case 2: Multiple correct options
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => true],
                ['option_text' => 'Paris', 'is_correct' => true],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.options.0', 'Multiple choice (single answer) must have exactly 1 correct option');
    }

    /**
     * Test: Multiple answer MCQ must have at least 1 correct option
     */
    public function test_multiple_mcq_requires_at_least_one_correct()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Which are European capitals?',
            'question_type' => 'multiple_choice_multiple',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => false],
                ['option_text' => 'Tokyo', 'is_correct' => false],
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.options.0', 'Multiple choice (multiple answers) must have at least 1 correct option');
    }

    /**
     * Test: True/False question validation
     */
    public function test_true_false_answer_validation()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Is Paris the capital of France?',
            'question_type' => 'true_false',
            'marks' => 2,
            'correct_answer' => 'maybe' // Invalid
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.correct_answer.0', 'True/False answer must be either "true" or "false"');
    }

    /**
     * Test: Matching pairs validation
     */
    public function test_matching_pairs_validation()
    {
        // Case 1: Less than 2 pairs
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Match the following',
            'question_type' => 'matching',
            'marks' => 5,
            'matching_pairs' => [
                ['left' => 'Apple', 'right' => 'Fruit']
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.matching_pairs.0', 'Matching questions must have at least 2 pairs');

        // Case 2: Incomplete pairs
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Match the following',
            'question_type' => 'matching',
            'marks' => 5,
            'matching_pairs' => [
                ['left' => 'Apple', 'right' => 'Fruit'],
                ['left' => 'Carrot', 'right' => ''] // Empty right
            ]
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.matching_pairs.0', 'All matching pairs must be complete');
    }

    /**
     * Test: Fill-in-the-blank validation
     */
    public function test_fill_blank_validation()
    {
        // Case 1: No blanks in question
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'fill_blank',
            'marks' => 5,
            'blank_answers' => ['Paris']
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.question_text.0', 'Fill-in-the-blank questions must contain at least one blank');

        // Case 2: Mismatched blanks and answers
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'The capital of France is _____ and the capital of Spain is _____.',
            'question_type' => 'fill_blank',
            'marks' => 5,
            'blank_answers' => ['Paris'] // Only 1 answer for 2 blanks
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.blank_answers.0', 'Number of blanks (2) must match number of answers (1)');
    }

    /**
     * Test: Ordering items validation
     */
    public function test_ordering_items_validation()
    {
        // Case 1: Less than 2 items
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Put in the correct order',
            'question_type' => 'ordering',
            'marks' => 5,
            'ordering_items' => ['First step']
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.ordering_items.0', 'Ordering questions must have at least 2 items');
    }

    /**
     * Test: Image-based question requires image URL
     */
    public function test_image_based_requires_url()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is shown in the image?',
            'question_type' => 'image_based',
            'marks' => 5,
            // Missing image_url
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.image_url.0', 'Image URL is required for image-based questions');
    }

    /**
     * Test: Audio-based question requires audio URL
     */
    public function test_audio_based_requires_url()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What do you hear in the audio?',
            'question_type' => 'audio_based',
            'marks' => 5,
            // Missing audio_url
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.audio_url.0', 'Audio URL is required for audio-based questions');
    }

    /**
     * Test: Passage question requires passage text
     */
    public function test_passage_requires_text()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Answer based on the passage',
            'question_type' => 'passage',
            'marks' => 5,
            // Missing passage_text
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.passage_text.0', 'Passage text is required for passage-based questions');
    }

    /**
     * Test: Calculation question requires correct answer
     */
    public function test_calculation_requires_answer()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'Calculate: 2 + 2 = ?',
            'question_type' => 'calculation',
            'marks' => 5,
            'formula' => '2 + 2',
            // Missing correct_answer
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.correct_answer.0', 'Correct answer is required for calculation questions');
    }

    /**
     * Test: Successful question creation with all validations passed
     */
    public function test_successful_question_creation()
    {
        $response = $this->postJson('/api/questions', [
            'exam_id' => $this->exam->id,
            'question_text' => 'What is the capital of France?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
            'options' => [
                ['option_text' => 'London', 'is_correct' => false],
                ['option_text' => 'Paris', 'is_correct' => true],
                ['option_text' => 'Berlin', 'is_correct' => false],
            ]
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Question created successfully');
        $response->assertJsonPath('question.question_type', 'multiple_choice_single');
    }

    /**
     * Test: Cannot edit questions for closed exam
     */
    public function test_cannot_edit_question_for_closed_exam()
    {
        // Create a question
        $question = Question::create([
            'exam_id' => $this->exam->id,
            'question_text' => 'Original question?',
            'question_type' => 'multiple_choice_single',
            'marks' => 5,
        ]);

        // Close the exam
        $this->exam->update(['status' => 'closed']);

        // Try to edit
        $response = $this->putJson("/api/questions/{$question->id}", [
            'question_text' => 'Updated question?',
            'marks' => 10,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.exam_id.0', 'Cannot edit questions for a closed exam');
    }

    /**
     * Test: Cannot increase marks beyond exam total
     */
    public function test_cannot_increase_marks_beyond_exam_total()
    {
        // Create a question with 90 marks
        $question = Question::create([
            'exam_id' => $this->exam->id,
            'question_text' => 'Question?',
            'question_type' => 'multiple_choice_single',
            'marks' => 90,
        ]);

        // Try to update to 50 marks (should be OK - exam total is 100)
        $response = $this->putJson("/api/questions/{$question->id}", [
            'marks' => 50,
        ]);

        $response->assertStatus(200);

        // Try to update to 60 marks (would exceed - 90 - 50 + 60 = 100, but 90 + 60 = 150)
        $question->update(['marks' => 30]); // Reset to 30
        $response = $this->putJson("/api/questions/{$question->id}", [
            'marks' => 80, // 30 + 80 = 110, exceeds 100
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.marks.0', 'Marks cannot exceed exam total marks');
    }
}
