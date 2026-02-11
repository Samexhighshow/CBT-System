<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreQuestionRequest;
use App\Http\Requests\UpdateQuestionRequest;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Exam;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\QuestionsImport;

class QuestionController extends Controller
{
    /**
     * PHASE 3: Enhanced Question Controller
     * Support for 14 comprehensive question types
     */

    protected $questionTypes = [
        'multiple_choice_single',
        'multiple_choice_multiple',
        'true_false',
        'short_answer',
        'essay',
        'fill_blank',
        'matching',
        'ordering',
        'image_based',
        'audio_based',
        'passage',
        'case_study',
        'calculation',
        'practical',
    ];

    /**
     * Display a listing of questions with advanced filtering
     */
    public function index(Request $request)
    {
        $query = Question::with(['exam', 'options', 'tags']);

        // Filter by exam
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by question type
        if ($request->has('question_type')) {
            $query->where('question_type', $request->question_type);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by difficulty
        if ($request->has('difficulty_level')) {
            $query->where('difficulty_level', $request->difficulty_level);
        }

        // PHASE 7: Filter by tags
        if ($request->has('tags')) {
            $tags = is_array($request->tags) ? $request->tags : explode(',', $request->tags);
            $query->whereHas('tags', function ($q) use ($tags) {
                $q->whereIn('question_tags.id', $tags);
            });
        }

        // PHASE 7: Filter by pool
        if ($request->has('pool_name')) {
            $query->where('pool_name', $request->pool_name);
        }

        // PHASE 7: Filter by cognitive level
        if ($request->has('cognitive_level')) {
            $query->where('cognitive_level', $request->cognitive_level);
        }

        // PHASE 7: Filter by topics
        if ($request->has('topics')) {
            $topics = is_array($request->topics) ? $request->topics : explode(',', $request->topics);
            $query->where(function ($q) use ($topics) {
                foreach ($topics as $topic) {
                    $q->orWhereJsonContains('topics', $topic);
                }
            });
        }

        // PHASE 7: Exclude archived
        if (!$request->boolean('include_archived')) {
            $query->where('is_archived', false);
        }

        // PHASE 7: Templates only
        if ($request->boolean('templates_only')) {
            $query->where('is_template', true);
        }

        // Search in question text
        if ($request->has('search')) {
            $search = $request->search;
            $query->whereRaw("MATCH(question_text) AGAINST(? IN BOOLEAN MODE)", [$search]);
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('limit', 15);
        $questions = $query->paginate($perPage);

        return response()->json([
            'data' => $questions->items(),
            'pagination' => [
                'current_page' => $questions->currentPage(),
                'last_page' => $questions->lastPage(),
                'per_page' => $questions->perPage(),
                'total' => $questions->total(),
            ]
        ]);
    }

    /**
     * Display the specified question
     */
    public function show($id)
    {
        $question = Question::with(['exam', 'options'])->findOrFail($id);
        return response()->json($question);
    }

    /**
     * Store a newly created question with support for all 14 types
     */
    public function store(StoreQuestionRequest $request)
    {
        $validated = $request->validated();
        
        // Get exam and validate it's open for editing
        $exam = Exam::findOrFail($validated['exam_id']);
        
        // Validate exam can accept this question
        $examErrors = $exam->validateQuestionAddition($validated['marks']);
        if (!empty($examErrors)) {
            return response()->json([
                'message' => 'Cannot add question to this exam',
                'errors' => $examErrors
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Prepare question data
            $questionData = [
                'exam_id' => $validated['exam_id'],
                'question_text' => $validated['question_text'],
                'question_type' => $validated['question_type'],
                'marks' => $validated['marks'],
                'difficulty_level' => $validated['difficulty_level'] ?? 'medium',
                'is_required' => $validated['is_required'] ?? false,
                'time_limit' => $validated['time_limit'] ?? null,
                'shuffle_options' => $validated['shuffle_options'] ?? false,
                'max_words' => $validated['max_words'] ?? null,
                'marking_rubric' => $validated['marking_rubric'] ?? null,
                'status' => $validated['status'] ?? 'active',
                // PHASE 7: Organization & Metadata
                'pool_name' => $validated['pool_name'] ?? null,
                'topics' => $validated['topics'] ?? [],
                'author_notes' => $validated['author_notes'] ?? null,
                'cognitive_level' => $validated['cognitive_level'] ?? null,
                'estimated_time' => $validated['estimated_time'] ?? null,
                'is_template' => $validated['is_template'] ?? false,
            ];

            // Store array-based question data
            $questionData['question_data'] = [
                'blank_answers' => $validated['blank_answers'] ?? [],
                'matching_pairs' => $validated['matching_pairs'] ?? [],
                'ordering_items' => $validated['ordering_items'] ?? [],
                'passage_text' => $validated['passage_text'] ?? null,
                'case_study_text' => $validated['case_study_text'] ?? null,
                'formula' => $validated['formula'] ?? null,
                'correct_answer' => $validated['correct_answer'] ?? null,
                'scenario_text' => $validated['scenario_text'] ?? null,
            ];

            // Store media in JSON field
            $questionData['question_media'] = [
                'image_url' => $validated['image_url'] ?? null,
                'audio_url' => $validated['audio_url'] ?? null,
                'video_url' => $validated['video_url'] ?? null,
            ];

            // Create question
            $question = Question::create($questionData);

            // Create options for choice-based types
            if ($this->isChoiceType($question->question_type) && !empty($validated['options'])) {
                foreach ($validated['options'] as $idx => $option) {
                    $question->options()->create([
                        'option_text' => $option['option_text'],
                        'is_correct' => $option['is_correct'],
                        'order_index' => $idx,
                    ]);
                }
            }

            // PHASE 7: Attach tags if provided
            if (!empty($validated['tag_ids'])) {
                $question->tags()->attach($validated['tag_ids']);
            }

            DB::commit();

            return response()->json([
                'message' => 'Question created successfully',
                'question' => $question->load(['options', 'tags'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create question',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified question
     */
    public function update(UpdateQuestionRequest $request, $id)
    {
        $question = Question::findOrFail($id);
        $validated = $request->validated();
        
        // Get exam and validate it's open for editing
        $exam = $question->exam;
        
        // Validate if marks are being changed
        if (isset($validated['marks']) && $validated['marks'] != $question->marks) {
            $examErrors = $exam->validateQuestionUpdate($question, $validated['marks']);
            if (!empty($examErrors)) {
                return response()->json([
                    'message' => 'Cannot update question marks',
                    'errors' => $examErrors
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // Prepare question data
            $questionData = [
                'exam_id' => $validated['exam_id'] ?? $question->exam_id,
                'question_text' => $validated['question_text'] ?? $question->question_text,
                'question_type' => $validated['question_type'] ?? $question->question_type,
                'marks' => $validated['marks'] ?? $question->marks,
                'max_words' => $validated['max_words'] ?? $question->max_words,
                'marking_rubric' => $validated['marking_rubric'] ?? $question->marking_rubric,
                'image_url' => $validated['image_url'] ?? $question->image_url,
                'audio_url' => $validated['audio_url'] ?? $question->audio_url,
                'passage_text' => $validated['passage_text'] ?? $question->passage_text,
                'case_study_text' => $validated['case_study_text'] ?? $question->case_study_text,
                'formula' => $validated['formula'] ?? $question->formula,
                'correct_answer' => $validated['correct_answer'] ?? $question->correct_answer,
                'scenario_text' => $validated['scenario_text'] ?? $question->scenario_text,
            ];

            // Update array-based question data
            $existingData = $question->question_data ?? [];
            $questionData['question_data'] = [
                'blank_answers' => $validated['blank_answers'] ?? $existingData['blank_answers'] ?? [],
                'matching_pairs' => $validated['matching_pairs'] ?? $existingData['matching_pairs'] ?? [],
                'ordering_items' => $validated['ordering_items'] ?? $existingData['ordering_items'] ?? [],
            ];

            // Handle options update if provided and question is choice-based
            if ($request->has('options') && $this->isChoiceType($questionData['question_type'])) {
                $question->options()->delete();
                
                foreach ($validated['options'] as $idx => $option) {
                    $question->options()->create([
                        'option_text' => $option['option_text'],
                        'is_correct' => $option['is_correct'],
                        'order_index' => $idx,
                    ]);
                }
            }

            $question->update($questionData);
            DB::commit();

            return response()->json([
                'message' => 'Question updated successfully',
                'question' => $question->load('options')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update question',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    

    

    /**
     * Get available question types
     */
    public function getQuestionTypes()
    {
        return response()->json([
            'choice_based' => [
                'multiple_choice_single' => 'Multiple Choice (Single)',
                'multiple_choice_multiple' => 'Multiple Choice (Multiple)',
                'true_false' => 'True / False',
            ],
            'text_based' => [
                'short_answer' => 'Short Answer',
                'essay' => 'Long Answer / Essay',
                'fill_blank' => 'Fill in the Blank',
            ],
            'interactive' => [
                'matching' => 'Matching / Pairing',
                'ordering' => 'Ordering / Sequencing',
            ],
            'media_based' => [
                'image_based' => 'Image-based',
                'audio_based' => 'Audio-based',
            ],
            'complex' => [
                'passage' => 'Passage / Comprehension',
                'case_study' => 'Case Study',
                'calculation' => 'Calculation / Formula',
                'practical' => 'Practical / Scenario',
            ],
        ]);
    }

    

    

    /**
     * Helper: Validate request data by question type
     */
    private function validateByType(Request $request, array $validated): array
    {
        $type = $validated['question_type'] ?? $request->input('question_type');

        switch ($type) {
            case 'multiple_choice_single':
            case 'multiple_choice_multiple':
                $request->validate([
                    'options' => 'required|array|min:2|max:6',
                    'options.*.option_text' => 'required|string',
                    'options.*.is_correct' => 'required|boolean',
                ]);
                $validated['shuffle_options'] = $request->input('shuffle_options', false);
                break;

            case 'true_false':
                $request->validate([
                    'correct_answer' => 'required|in:true,false',
                ]);
                $validated['question_data'] = [
                    'correct_answer' => $request->input('correct_answer')
                ];
                break;

            case 'short_answer':
            case 'essay':
                $request->validate([
                    'max_words' => 'required|integer|min:1',
                    'marking_rubric' => 'nullable|string',
                ]);
                $validated['max_words'] = $request->input('max_words');
                $validated['marking_rubric'] = $request->input('marking_rubric');
                break;

            case 'fill_blank':
                $request->validate([
                    'blank_answers' => 'required|array|min:1',
                    'blank_answers.*' => 'required|string',
                ]);
                $validated['question_data'] = [
                    'blank_answers' => $request->input('blank_answers')
                ];
                break;

            case 'matching':
                $request->validate([
                    'matching_pairs' => 'required|array|min:2',
                    'matching_pairs.*.left' => 'required|string',
                    'matching_pairs.*.right' => 'required|string',
                ]);
                $validated['question_data'] = [
                    'matching_pairs' => $request->input('matching_pairs')
                ];
                break;

            case 'ordering':
                $request->validate([
                    'ordering_items' => 'required|array|min:2',
                    'ordering_items.*' => 'required|string',
                ]);
                $validated['question_data'] = [
                    'ordering_items' => $request->input('ordering_items')
                ];
                break;

            case 'image_based':
                $request->validate([
                    'question_media' => 'required|array',
                    'question_media.image_url' => 'required|url',
                ]);
                $validated['question_media'] = $request->input('question_media');
                break;

            case 'audio_based':
                $request->validate([
                    'question_media' => 'required|array',
                    'question_media.audio_url' => 'required|url',
                    'max_words' => 'nullable|integer|min:1',
                ]);
                $validated['question_media'] = $request->input('question_media');
                break;

            case 'passage':
                $request->validate([
                    'question_data' => 'required|array',
                    'question_data.passage_text' => 'required|string|min:50',
                ]);
                $validated['question_data'] = $request->input('question_data');
                break;

            case 'case_study':
                $request->validate([
                    'question_data' => 'required|array',
                    'question_data.case_study_text' => 'required|string|min:50',
                ]);
                $validated['question_data'] = $request->input('question_data');
                break;

            case 'calculation':
                $request->validate([
                    'question_data' => 'required|array',
                    'question_data.formula' => 'nullable|string',
                    'question_data.correct_answer' => 'required|string',
                ]);
                $validated['question_data'] = $request->input('question_data');
                break;

            case 'practical':
                $request->validate([
                    'question_data' => 'required|array',
                    'question_data.scenario_text' => 'required|string|min:50',
                    'marking_rubric' => 'required|string',
                ]);
                $validated['question_data'] = $request->input('question_data');
                $validated['marking_rubric'] = $request->input('marking_rubric');
                break;
        }

        return $validated;
    }

    /**
     * Helper: Check if question type uses options table
     */
    private function isChoiceType(string $type): bool
    {
        return in_array($type, [
            'multiple_choice_single',
            'multiple_choice_multiple',
            'true_false'
        ]);
    }

    /**
     * Bulk create questions
     */
    public function bulkCreate(Request $request)
    {
        $validated = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'subject_id' => 'required|exists:subjects,id',
            'questions' => 'required|array|min:1',
            'questions.*.question_text' => 'required|string',
            'questions.*.question_type' => 'required|in:multiple_choice,true_false,short_answer,essay',
            'questions.*.marks' => 'required|integer|min:1',
            'questions.*.difficulty_level' => 'nullable|in:easy,medium,hard',
            'questions.*.options' => 'required_if:questions.*.question_type,multiple_choice,true_false|array|min:2',
            'questions.*.options.*.option_text' => 'required|string',
            'questions.*.options.*.is_correct' => 'required|boolean',
        ]);

        DB::beginTransaction();
        try {
            $createdQuestions = [];

            foreach ($validated['questions'] as $questionData) {
                $options = $questionData['options'] ?? [];
                unset($questionData['options']);

                $questionData['exam_id'] = $validated['exam_id'];
                $questionData['subject_id'] = $validated['subject_id'];

                $question = Question::create($questionData);

                // Create options
                foreach ($options as $option) {
                    $question->options()->create($option);
                }

                $createdQuestions[] = $question->load('options');
            }

            DB::commit();

            return response()->json([
                'message' => count($createdQuestions) . ' questions created successfully',
                'questions' => $createdQuestions
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create questions', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Import questions from CSV/Excel
     */
    public function importQuestions(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls',
            'exam_id' => 'required|exists:exams,id',
            'subject_id' => 'required|exists:subjects,id',
        ]);

        try {
            $import = new QuestionsImport($validated['exam_id'], $validated['subject_id']);
            Excel::import($import, $request->file('file'));

            return response()->json([
                'message' => 'Questions imported successfully',
                'imported_count' => $import->getImportedCount(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to import questions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download CSV template for question import
     */
    public function downloadTemplate()
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="questions_template.csv"',
        ];

        $columns = [
            'question_text',
            'question_type',
            'marks',
            'difficulty_level',
            'option_1',
            'option_2',
            'option_3',
            'option_4',
            'correct_option',
        ];

        $callback = function() use ($columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            
            // Add sample row
            fputcsv($file, [
                'What is the capital of Nigeria?',
                'multiple_choice',
                '2',
                'easy',
                'Lagos',
                'Abuja',
                'Kano',
                'Port Harcourt',
                '2', // Index of correct option (Abuja)
            ]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export questions to CSV
     */
    public function exportQuestions(Request $request)
    {
        $query = Question::with(['options', 'exam']);

        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Subject filter not supported

        $questions = $query->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="questions_export.csv"',
        ];

        $callback = function() use ($questions) {
            $file = fopen('php://output', 'w');
            
            // Header row
            fputcsv($file, [
                'ID',
                'Question Text',
                'Type',
                'Marks',
                'Difficulty',
                'Subject',
                'Exam',
                'Option 1',
                'Option 2',
                'Option 3',
                'Option 4',
                'Correct Option',
            ]);

            foreach ($questions as $question) {
                $options = $question->options->pluck('option_text')->toArray();
                $correctIndex = $question->options->search(fn($opt) => $opt->is_correct) + 1;

                fputcsv($file, [
                    $question->id,
                    $question->question_text,
                    $question->question_type,
                    $question->marks,
                    $question->difficulty_level ?? 'medium',
                    '',
                    $question->exam->title ?? '',
                    $options[0] ?? '',
                    $options[1] ?? '',
                    $options[2] ?? '',
                    $options[3] ?? '',
                    $correctIndex,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * PHASE 5: ADMIN ACTIONS
     */

    /**
     * Duplicate a question
     */
    public function duplicate(Request $request, $id)
    {
        $question = Question::findOrFail($id);
        $exam = $question->exam;

        // Check if exam is closed
        if ($exam->isClosed()) {
            return response()->json([
                'message' => 'Cannot duplicate questions for a closed exam',
                'error' => 'Exam is closed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Create duplicate question
            $newQuestion = $question->replicate();
            $newQuestion->status = 'draft';
            $newQuestion->save();

            // Duplicate options if it's a choice-based question
            if ($this->isChoiceType($newQuestion->question_type)) {
                foreach ($question->options as $option) {
                    $newQuestion->options()->create([
                        'option_text' => $option->option_text,
                        'is_correct' => $option->is_correct,
                        'order_index' => $option->order_index,
                        'option_media' => $option->option_media,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Question duplicated successfully',
                'question' => $newQuestion->load('options'),
                'original_id' => $question->id,
                'new_id' => $newQuestion->id,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to duplicate question',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a question (only if exam is not closed)
     */
    public function destroy(Request $request, $id)
    {
        $question = Question::findOrFail($id);
        $exam = $question->exam;

        // Check if exam is closed
        if ($exam->isClosed()) {
            return response()->json([
                'message' => 'Cannot delete questions from a closed exam',
                'error' => 'Exam is closed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Delete options first (if any)
            $question->options()->delete();
            
            // Delete question
            $question->delete();

            DB::commit();

            return response()->json([
                'message' => 'Question deleted successfully',
                'deleted_id' => $id
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to delete question',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle question status (enable/disable)
     */
    public function toggleStatus(Request $request, $id)
    {
        $question = Question::findOrFail($id);
        $exam = $question->exam;

        // Check if exam is closed
        if ($exam->isClosed()) {
            return response()->json([
                'message' => 'Cannot modify questions in a closed exam',
                'error' => 'Exam is closed'
            ], 422);
        }

        try {
            $currentStatus = $question->status;
            $newStatus = $currentStatus === 'active' ? 'disabled' : 'active';
            
            $question->update(['status' => $newStatus]);

            return response()->json([
                'message' => "Question " . ($newStatus === 'active' ? 'enabled' : 'disabled') . " successfully",
                'question' => $question,
                'previous_status' => $currentStatus,
                'new_status' => $newStatus
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update question status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reorder questions within an exam
     */
    public function reorderQuestions(Request $request, $examId)
    {
        $request->validate([
            'questions' => ['required', 'array'],
            'questions.*.id' => ['required', 'integer', 'exists:exam_questions,id'],
            'questions.*.order' => ['required', 'integer', 'min:0'],
        ]);

        $exam = Exam::findOrFail($examId);

        // Check if exam is closed
        if ($exam->isClosed()) {
            return response()->json([
                'message' => 'Cannot reorder questions in a closed exam',
                'error' => 'Exam is closed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            foreach ($request->questions as $item) {
                Question::where('id', $item['id'])
                    ->where('exam_id', $examId)
                    ->update(['order_index' => $item['order']]);
            }

            DB::commit();

            $reorderedQuestions = $exam->questions()->orderBy('order_index')->get();

            return response()->json([
                'message' => 'Questions reordered successfully',
                'exam_id' => $examId,
                'questions' => $reorderedQuestions
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to reorder questions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Preview question as student would see it
     */
    public function preview(Request $request, $id)
    {
        try {
            $question = Question::with(['options', 'exam'])->findOrFail($id);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Question not found'], 404);
        }

        // Optionally randomize options if enabled in exam
        $options = $question->options;
        if ($question->exam && $question->exam->randomize_options) {
            $options = $options->shuffle();
        }

        // Format response as student would see
        $preview = [
            'id' => $question->id,
            'question_text' => $question->question_text,
            'question_type' => $question->question_type,
            'marks' => $question->marks,
            'time_limit' => $question->time_limit,
            'is_required' => $question->is_required,
            'image_url' => $question->image_url,
            'audio_url' => $question->audio_url,
            'passage_text' => $question->passage_text,
            'case_study_text' => $question->case_study_text,
            'scenario_text' => $question->scenario_text,
            'options' => $options->map(function($opt) {
                return [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                    'order_index' => $opt->order_index
                ];
            }),
            'max_words' => $question->max_words,
            'formula' => $question->formula,
        ];

        // Include question_data for complex types
        if ($question->question_data) {
            $preview['blank_answers_count'] = count($question->question_data['blank_answers'] ?? []);
            $preview['matching_pairs_count'] = count($question->question_data['matching_pairs'] ?? []);
            $preview['ordering_items_count'] = count($question->question_data['ordering_items'] ?? []);
        }

        return response()->json([
            'message' => 'Question preview',
            'preview' => $preview,
            'exam' => [
                'id' => $question->exam->id,
                'title' => $question->exam->title,
                'duration_minutes' => $question->exam->duration_minutes,
            ]
        ]);
    }

    /**
     * Bulk delete questions
     */
    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'question_ids' => ['required', 'array'],
            'question_ids.*' => ['integer', 'exists:exam_questions,id'],
        ]);

        $questionIds = $request->question_ids;
        
        // Get unique exam IDs from questions
        $questions = Question::whereIn('id', $questionIds)->get();
        $examIds = $questions->pluck('exam_id')->unique();

        // Check if any exam is closed
        $closedExams = Exam::whereIn('id', $examIds)
            ->where('status', 'closed')
            ->get();

        if ($closedExams->isNotEmpty()) {
            return response()->json([
                'message' => 'Cannot delete questions from closed exams',
                'closed_exams' => $closedExams->pluck('id'),
                'error' => 'Some exams are closed'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Delete options first
            QuestionOption::whereIn('question_id', $questionIds)->delete();
            
            // Delete questions
            $deleted = Question::whereIn('id', $questionIds)->delete();

            DB::commit();

            return response()->json([
                'message' => 'Questions deleted successfully',
                'deleted_count' => $deleted,
                'question_ids' => $questionIds
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to delete questions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk update question status
     */
    public function bulkUpdateStatus(Request $request)
    {
        $request->validate([
            'question_ids' => ['required', 'array'],
            'question_ids.*' => ['integer', 'exists:exam_questions,id'],
            'status' => ['required', 'in:active,disabled,draft'],
        ]);

        $questionIds = $request->question_ids;
        $newStatus = $request->status;
        
        // Get unique exam IDs from questions
        $questions = Question::whereIn('id', $questionIds)->get();
        $examIds = $questions->pluck('exam_id')->unique();

        // Check if any exam is closed
        $closedExams = Exam::whereIn('id', $examIds)
            ->where('status', 'closed')
            ->get();

        if ($closedExams->isNotEmpty()) {
            return response()->json([
                'message' => 'Cannot modify questions in closed exams',
                'closed_exams' => $closedExams->pluck('id'),
                'error' => 'Some exams are closed'
            ], 422);
        }

        try {
            $updated = Question::whereIn('id', $questionIds)
                ->update(['status' => $newStatus]);

            return response()->json([
                'message' => "Questions updated to {$newStatus} successfully",
                'updated_count' => $updated,
                'question_ids' => $questionIds,
                'new_status' => $newStatus
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update question status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Group questions by sections (for passages, case studies)
     */
    public function groupQuestions(Request $request, $examId)
    {
        $request->validate([
            'group_by' => ['required', 'in:question_type,section,passage'],
        ]);

        $exam = Exam::findOrFail($examId);
        $groupBy = $request->group_by;

        $questions = $exam->questions()
            ->with(['options'])
            ->orderBy('order_index')
            ->get();

        $grouped = match($groupBy) {
            'question_type' => $questions->groupBy('question_type')
                ->mapWithKeys(fn($group, $type) => [
                    $type => [
                        'count' => $group->count(),
                        'total_marks' => $group->sum('marks'),
                        'questions' => $group->values(),
                    ]
                ]),
            
            'passage' => $questions->groupBy(fn($q) => $q->passage_text ?? 'no_passage')
                ->mapWithKeys(fn($group, $passage) => [
                    substr($passage, 0, 50) . (strlen($passage) > 50 ? '...' : '') => [
                        'count' => $group->count(),
                        'total_marks' => $group->sum('marks'),
                        'questions' => $group->values(),
                    ]
                ]),
            
            'section' => $questions->groupBy(fn($q) => $q->section_name ?? 'ungrouped')
                ->mapWithKeys(fn($group, $section) => [
                    $section => [
                        'count' => $group->count(),
                        'total_marks' => $group->sum('marks'),
                        'questions' => $group->values(),
                    ]
                ]),
        };

        return response()->json([
            'message' => "Questions grouped by {$groupBy}",
            'exam_id' => $examId,
            'group_by' => $groupBy,
            'groups' => $grouped,
            'total_questions' => $questions->count(),
            'total_marks' => $questions->sum('marks'),
        ]);
    }

    /**
     * Get question statistics for an exam
     */
    public function getExamStatistics(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);
        $questions = $exam->questions()->get();

        $statistics = [
            'total_questions' => $questions->count(),
            'total_marks' => $questions->sum('marks'),
            'by_type' => $questions->groupBy('question_type')
                ->mapWithKeys(fn($group, $type) => [
                    $type => [
                        'count' => $group->count(),
                        'marks' => $group->sum('marks'),
                        'percentage' => round(($group->count() / max(1, $questions->count())) * 100, 2),
                    ]
                ]),
            'by_difficulty' => $questions->groupBy('difficulty_level')
                ->mapWithKeys(fn($group, $level) => [
                    $level => [
                        'count' => $group->count(),
                        'marks' => $group->sum('marks'),
                        'percentage' => round(($group->count() / max(1, $questions->count())) * 100, 2),
                    ]
                ]),
            'by_status' => $questions->groupBy('status')
                ->mapWithKeys(fn($group, $status) => [
                    $status => [
                        'count' => $group->count(),
                        'marks' => $group->sum('marks'),
                    ]
                ]),
        ];

        return response()->json([
            'message' => 'Exam statistics',
            'exam_id' => $examId,
            'exam_title' => $exam->title,
            'statistics' => $statistics,
        ]);
    }
}
