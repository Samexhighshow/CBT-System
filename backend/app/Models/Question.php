<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    use HasFactory;

    protected $table = 'exam_questions';
    protected $fillable = [
        'exam_id', 
        'question_text', 
        'question_type', 
        'question_media',
        'marks', 
        'difficulty_level', 
        'is_required',
        'time_limit',
        'shuffle_options',
        'max_words',
        'marking_rubric',
        'status',
        'question_data',
        'metadata',
        'order_index',
        'section_name',
        // Phase 7 fields
        'pool_name',
        'topics',
        'author_notes',
        'usage_count',
        'last_used_at',
        'cognitive_level',
        'estimated_time',
        'is_template',
        'is_archived',
    ];

    protected $casts = [
        'metadata' => 'array',
        'marks' => 'integer',
        'max_words' => 'integer',
        'time_limit' => 'integer',
        'is_required' => 'boolean',
        'shuffle_options' => 'boolean',
        'question_media' => 'array',
        'question_data' => 'array',
        // Phase 7 casts
        'topics' => 'array',
        'usage_count' => 'integer',
        'last_used_at' => 'datetime',
        'estimated_time' => 'integer',
        'is_template' => 'boolean',
        'is_archived' => 'boolean',
    ];

    /**
     * Relationship to Exam
     */
    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    /**
     * Relationship to bank question source (for exam questions linked from Question Bank)
     */
    public function bankQuestion(): BelongsTo
    {
        return $this->belongsTo(BankQuestion::class, 'bank_question_id');
    }

    /**
     * Relationship to Question Options (for MCQ, True/False, etc)
     */
    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class, 'question_id')
            ->orderBy('order_index');
    }

    /**
     * Tags relationship (Phase 7)
     */
    public function tags(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(
            QuestionTag::class,
            'question_tag_pivot',
            'question_id',
            'tag_id'
        )->withTimestamps();
    }

    /**
     * Get the pool this question belongs to (Phase 7)
     */
    public function pool()
    {
        if (!$this->pool_name) {
            return null;
        }
        
        return QuestionPool::where('name', $this->pool_name)
            ->where('exam_id', $this->exam_id)
            ->first();
    }

    /**
     * Get question type display name
     */
    public function getQuestionTypeLabel(): string
    {
        return match($this->question_type) {
            'multiple_choice_single' => 'Multiple Choice (Single)',
            'multiple_choice_multiple' => 'Multiple Choice (Multiple)',
            'true_false' => 'True / False',
            'short_answer' => 'Short Answer',
            'essay' => 'Long Answer / Essay',
            'fill_blank' => 'Fill in the Blank',
            'matching' => 'Matching / Pairing',
            'ordering' => 'Ordering / Sequencing',
            'image_based' => 'Image-based',
            'audio_based' => 'Audio-based',
            'passage' => 'Passage / Comprehension',
            'case_study' => 'Case Study',
            'calculation' => 'Calculation / Formula',
            'practical' => 'Practical / Scenario',
            default => $this->question_type
        };
    }

    /**
     * Check if this is a choice-based question type
     */
    public function isChoiceType(): bool
    {
        return in_array($this->question_type, [
            'multiple_choice_single',
            'multiple_choice_multiple',
            'true_false'
        ]);
    }

    /**
     * Check if this is a text-based question type
     */
    public function isTextType(): bool
    {
        return in_array($this->question_type, [
            'short_answer',
            'essay',
            'fill_blank'
        ]);
    }

    /**
     * Check if this is an interactive question type
     */
    public function isInteractiveType(): bool
    {
        return in_array($this->question_type, [
            'matching',
            'ordering'
        ]);
    }

    /**
     * Check if this is a media-based question type
     */
    public function isMediaType(): bool
    {
        return in_array($this->question_type, [
            'image_based',
            'audio_based'
        ]);
    }

    /**
     * Check if this is a complex question type
     */
    public function isComplexType(): bool
    {
        return in_array($this->question_type, [
            'passage',
            'case_study',
            'calculation',
            'practical'
        ]);
    }

    /**
     * Validation helpers
     */

    /**
     * Validate MCQ options (single or multiple answer)
     */
    public function validateMCQOptions(array $options): array
    {
        $errors = [];

        if (count($options) < 2) {
            $errors[] = 'Multiple choice questions must have at least 2 options';
            return $errors;
        }

        if (count($options) > 10) {
            $errors[] = 'Multiple choice questions cannot have more than 10 options';
        }

        // Check if all options have text
        foreach ($options as $index => $option) {
            if (empty($option['option_text'])) {
                $errors[] = "Option " . ($index + 1) . " is empty";
            }
        }

        // Validate correct options based on type
        $correctCount = collect($options)->where('is_correct', true)->count();

        if ($this->question_type === 'multiple_choice_single' && $correctCount !== 1) {
            $errors[] = 'Single answer MCQ must have exactly 1 correct option';
        } elseif ($this->question_type === 'multiple_choice_multiple' && $correctCount < 1) {
            $errors[] = 'Multiple answer MCQ must have at least 1 correct option';
        }

        return $errors;
    }

    /**
     * Validate true/false answer
     */
    public function validateTrueFalseAnswer(string $answer): array
    {
        $errors = [];

        if (!in_array($answer, ['true', 'false'])) {
            $errors[] = 'True/False answer must be either "true" or "false"';
        }

        return $errors;
    }

    /**
     * Validate fill-in-the-blank structure
     */
    public function validateFillInTheBlank(string $questionText, array $answers): array
    {
        $errors = [];

        // Count blanks in question
        $blankCount = substr_count($questionText, '_____');

        if ($blankCount === 0) {
            $errors[] = 'Fill-in-the-blank questions must contain at least one blank (indicated by _____)';
        }

        // Count answers
        $answerCount = count(array_filter($answers)); // Count non-empty answers

        if ($blankCount > 0 && $blankCount !== $answerCount) {
            $errors[] = "Number of blanks ($blankCount) must match number of answers ($answerCount)";
        }

        // Check for empty answers
        foreach ($answers as $index => $answer) {
            if (empty($answer)) {
                $errors[] = "Answer for blank " . ($index + 1) . " is empty";
            }
        }

        return $errors;
    }

    /**
     * Validate matching pairs
     */
    public function validateMatchingPairs(array $pairs): array
    {
        $errors = [];

        if (count($pairs) < 2) {
            $errors[] = 'Matching questions must have at least 2 pairs';
            return $errors;
        }

        if (count($pairs) > 20) {
            $errors[] = 'Matching questions cannot have more than 20 pairs';
        }

        // Check for complete pairs
        foreach ($pairs as $index => $pair) {
            if (empty($pair['left']) || empty($pair['right'])) {
                $errors[] = "Pair " . ($index + 1) . " is incomplete (both left and right items required)";
            }
        }

        // Check for duplicate pairs
        $pairCombinations = collect($pairs)->map(fn($p) => $p['left'] . '|' . $p['right'])->toArray();
        if (count($pairCombinations) !== count(array_unique($pairCombinations))) {
            $errors[] = 'Duplicate pairs are not allowed';
        }

        return $errors;
    }

    /**
     * Validate ordering items
     */
    public function validateOrderingItems(array $items): array
    {
        $errors = [];

        if (count($items) < 2) {
            $errors[] = 'Ordering questions must have at least 2 items';
            return $errors;
        }

        if (count($items) > 20) {
            $errors[] = 'Ordering questions cannot have more than 20 items';
        }

        // Check for empty items
        foreach ($items as $index => $item) {
            if (empty($item)) {
                $errors[] = "Item " . ($index + 1) . " is empty";
            }
        }

        // Check for duplicates
        $uniqueItems = array_unique(array_filter($items));
        if (count($uniqueItems) !== count(array_filter($items))) {
            $errors[] = 'Duplicate items are not allowed';
        }

        return $errors;
    }

    /**
     * Validate marks against exam's total marks
     */
    public function validateMarksAgainstExam(float $marks): array
    {
        $errors = [];

        if ($marks <= 0) {
            $errors[] = 'Marks must be greater than 0';
        }

        if ($this->exam && $marks > $this->exam->total_marks) {
            $errors[] = "Marks cannot exceed exam's total marks ({$this->exam->total_marks})";
        }

        return $errors;
    }

    /**
     * Validate if exam is available for editing
     */
    public function validateExamStatus(): array
    {
        $errors = [];

        if ($this->exam && $this->exam->status === 'closed') {
            $errors[] = 'Cannot edit questions for a closed exam';
        }

        if ($this->exam && $this->exam->status === 'published') {
            // This might be a warning rather than an error in some systems
            // $errors[] = 'This exam is published. Editing may affect students';
        }

        return $errors;
    }

    /**
     * Comprehensive validation method
     */
    public function validateAllFields(array $data = []): array
    {
        $errors = [];
        $data = $data ?: $this->toArray();

        // Validate exam status
        $errors = array_merge($errors, $this->validateExamStatus());

        // Validate marks
        $errors = array_merge($errors, $this->validateMarksAgainstExam($data['marks'] ?? 0));

        // Type-specific validation
        switch ($this->question_type) {
            case 'multiple_choice_single':
            case 'multiple_choice_multiple':
                $errors = array_merge($errors, $this->validateMCQOptions($data['options'] ?? []));
                break;

            case 'true_false':
                $errors = array_merge($errors, $this->validateTrueFalseAnswer($data['correct_answer'] ?? ''));
                break;

            case 'fill_blank':
                $errors = array_merge($errors, $this->validateFillInTheBlank(
                    $data['question_text'] ?? '',
                    $data['blank_answers'] ?? []
                ));
                break;

            case 'matching':
                $errors = array_merge($errors, $this->validateMatchingPairs($data['matching_pairs'] ?? []));
                break;

            case 'ordering':
                $errors = array_merge($errors, $this->validateOrderingItems($data['ordering_items'] ?? []));
                break;
        }

        return $errors;
    }
}
