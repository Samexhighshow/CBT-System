<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Services\QuestionSelectionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExamQuestionRandomizationController extends Controller
{
    protected $selectionService;

    public function __construct(QuestionSelectionService $selectionService)
    {
        $this->selectionService = $selectionService;
    }

    /**
     * Update exam randomization settings
     */
    public function updateRandomizationSettings(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);

        // Prevent changes if questions are locked
        if ($exam->questions_locked) {
            return response()->json([
                'message' => 'Cannot modify randomization settings after questions are locked',
            ], 422);
        }

        // Normalize marks_distribution format: convert from array of objects to indexed array
        $marksDistribution = $request->input('marks_distribution');
        if ($marksDistribution && is_array($marksDistribution)) {
            $normalized = [];
            foreach ($marksDistribution as $item) {
                if (is_array($item) && isset($item['marks']) && isset($item['count'])) {
                    $normalized[(int)$item['marks']] = (int)$item['count'];
                }
            }
            if (count($normalized) > 0) {
                $request->merge(['marks_distribution' => $normalized]);
            }
        }

        $validator = Validator::make($request->all(), [
            'question_selection_mode' => 'nullable|in:fixed,random',
            'total_questions_to_serve' => 'nullable|integer|min:1',
            'shuffle_question_order' => 'nullable|boolean',
            'shuffle_option_order' => 'nullable|boolean',
            'question_distribution' => 'nullable|in:same_for_all,unique_per_student',
            'difficulty_distribution' => 'nullable|array',
            'difficulty_distribution.easy' => 'nullable|integer|min:0',
            'difficulty_distribution.medium' => 'nullable|integer|min:0',
            'difficulty_distribution.hard' => 'nullable|integer|min:0',
            'marks_distribution' => 'nullable|array',
            'topic_filters' => 'nullable|array',
            'question_reuse_policy' => 'nullable|in:allow_reuse,no_reuse_until_exhausted',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Validate distribution totals match
        if ($request->has('difficulty_distribution') && $request->difficulty_distribution !== null && $request->has('total_questions_to_serve')) {
            $distribution = $request->difficulty_distribution;
            if (is_array($distribution) && count($distribution) > 0) {
                // Filter out null values
                $distribution = array_filter($distribution, fn($v) => $v !== null);
                if (count($distribution) > 0) {
                    $totalFromDistribution = array_sum($distribution);
                    if ($totalFromDistribution != $request->total_questions_to_serve) {
                        return response()->json([
                            'message' => 'Difficulty distribution total must match total questions to serve',
                            'errors' => ['difficulty_distribution' => [
                                "Distribution total ({$totalFromDistribution}) does not match total questions ({$request->total_questions_to_serve})"
                            ]]
                        ], 422);
                    }
                }
            }
        }

        if ($request->has('marks_distribution') && $request->marks_distribution !== null && $request->has('total_questions_to_serve')) {
            $distribution = $request->marks_distribution;
            if (is_array($distribution) && count($distribution) > 0) {
                // Filter out null values and sum only the count values
                $counts = array_filter(
                    array_map(fn($item) => is_array($item) ? ($item['count'] ?? null) : null, $distribution),
                    fn($v) => $v !== null
                );
                if (count($counts) > 0) {
                    $totalFromDistribution = array_sum($counts);
                    if ($totalFromDistribution != $request->total_questions_to_serve) {
                        return response()->json([
                            'message' => 'Marks distribution total must match total questions to serve',
                            'errors' => ['marks_distribution' => [
                                "Distribution total ({$totalFromDistribution}) does not match total questions ({$request->total_questions_to_serve})"
                            ]]
                        ], 422);
                    }
                }
            }
        }

        // Update exam settings
        $exam->update($request->only([
            'question_selection_mode',
            'total_questions_to_serve',
            'shuffle_question_order',
            'shuffle_option_order',
            'question_distribution',
            'difficulty_distribution',
            'marks_distribution',
            'topic_filters',
            'question_reuse_policy',
        ]));

        // Reload fresh data and return current stats
        $exam->refresh();
        
        $totalQuestions = $exam->questions()->count();
        $activeQuestions = $exam->questions()->where('status', 'active')->count();
        
        $difficultyBreakdown = $exam->questions()
            ->selectRaw('difficulty_level, COUNT(*) as count')
            ->groupBy('difficulty_level')
            ->pluck('count', 'difficulty_level')
            ->toArray();

        $marksBreakdown = $exam->questions()
            ->selectRaw('marks, COUNT(*) as count')
            ->groupBy('marks')
            ->pluck('count', 'marks')
            ->toArray();

        return response()->json([
            'message' => 'Randomization settings updated successfully',
            'exam_id' => $exam->id,
            'total_questions' => $totalQuestions,
            'active_questions' => $activeQuestions,
            'questions_locked' => $exam->questions_locked,
            'locked_at' => $exam->questions_locked_at,
            'settings' => [
                'selection_mode' => $exam->question_selection_mode,
                'total_to_serve' => $exam->total_questions_to_serve,
                'shuffle_questions' => $exam->shuffle_question_order,
                'shuffle_options' => $exam->shuffle_option_order,
                'distribution_mode' => $exam->question_distribution,
                'difficulty_distribution' => $exam->difficulty_distribution,
                'marks_distribution' => $exam->marks_distribution,
                'topic_filters' => $exam->topic_filters,
                'reuse_policy' => $exam->question_reuse_policy,
            ],
            'available_questions' => [
                'by_difficulty' => $difficultyBreakdown,
                'by_marks' => $marksBreakdown,
            ],
        ]);
    }

    /**
     * Generate preview of question selection
     */
    public function previewSelection($examId)
    {
        $exam = Exam::findOrFail($examId);
        
        $preview = $this->selectionService->generatePreview($exam);

        return response()->json($preview);
    }

    /**
     * Lock exam questions (freeze selection)
     */
    public function lockQuestions($examId)
    {
        $exam = Exam::findOrFail($examId);

        if ($exam->questions_locked) {
            return response()->json([
                'message' => 'Questions are already locked',
            ], 422);
        }

        // Validate that exam has questions
        $questionsCount = $exam->questions()->count();
        if ($questionsCount === 0) {
            return response()->json([
                'message' => 'Cannot lock exam with no questions',
            ], 422);
        }

        $this->selectionService->lockExamQuestions($exam);

        return response()->json([
            'message' => 'Exam questions locked successfully',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Unlock exam questions (allow modifications)
     */
    public function unlockQuestions($examId)
    {
        $exam = Exam::findOrFail($examId);

        if (!$exam->questions_locked) {
            return response()->json([
                'message' => 'Questions are not locked',
            ], 422);
        }

        $exam->update([
            'questions_locked' => false,
            'questions_locked_at' => null,
        ]);

        // Delete existing selections to regenerate
        $exam->questionSelections()->delete();

        return response()->json([
            'message' => 'Exam questions unlocked successfully. Existing selections will be regenerated.',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Get question selection for a student
     */
    public function getStudentSelection(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);
        
        $studentId = $request->input('student_id');
        $userId = $request->input('user_id', auth()->id());

        if (!$studentId && !$userId) {
            return response()->json([
                'message' => 'Student ID or User ID required',
            ], 422);
        }

        $selection = $this->selectionService->generateSelectionForStudent($exam, $studentId, $userId);

        // Load actual questions
        $questions = \App\Models\Question::whereIn('id', $selection->question_ids)
            ->with('options')
            ->get()
            ->sortBy(function ($question) use ($selection) {
                return array_search($question->id, $selection->question_ids);
            })
            ->values();

        // Apply option shuffles if configured
        if ($selection->option_shuffles && $exam->shuffle_option_order) {
            $questions = $questions->map(function ($question) use ($selection) {
                if (isset($selection->option_shuffles[$question->id])) {
                    $shuffledOrder = $selection->option_shuffles[$question->id];
                    $question->options = $question->options->sortBy(function ($option) use ($shuffledOrder) {
                        return array_search($option->id, $shuffledOrder);
                    })->values();
                }
                return $question;
            });
        }

        // Update usage statistics
        $this->selectionService->updateQuestionUsage($selection->question_ids);

        return response()->json([
            'selection' => $selection,
            'questions' => $questions,
            'exam' => $exam->only([
                'id', 'title', 'duration_minutes', 'total_questions_to_serve',
                'shuffle_question_order', 'shuffle_option_order',
            ]),
        ]);
    }

    /**
     * Get exam randomization stats
     */
    public function getRandomizationStats($examId)
    {
        $exam = Exam::findOrFail($examId);

        $totalQuestions = $exam->questions()->count();
        $activeQuestions = $exam->questions()->where('status', 'active')->count();
        $selectionsCount = $exam->questionSelections()->count();
        
        $difficultyBreakdown = $exam->questions()
            ->selectRaw('difficulty_level, COUNT(*) as count')
            ->groupBy('difficulty_level')
            ->pluck('count', 'difficulty_level')
            ->toArray();

        $marksBreakdown = $exam->questions()
            ->selectRaw('marks, COUNT(*) as count')
            ->groupBy('marks')
            ->pluck('count', 'marks')
            ->toArray();

        return response()->json([
            'exam_id' => $exam->id,
            'total_questions' => $totalQuestions,
            'active_questions' => $activeQuestions,
            'selections_generated' => $selectionsCount,
            'questions_locked' => $exam->questions_locked,
            'locked_at' => $exam->questions_locked_at,
            'settings' => [
                'selection_mode' => $exam->question_selection_mode,
                'total_to_serve' => $exam->total_questions_to_serve,
                'shuffle_questions' => $exam->shuffle_question_order,
                'shuffle_options' => $exam->shuffle_option_order,
                'distribution_mode' => $exam->question_distribution,
                'difficulty_distribution' => $exam->difficulty_distribution,
                'marks_distribution' => $exam->marks_distribution,
                'topic_filters' => $exam->topic_filters,
                'reuse_policy' => $exam->question_reuse_policy,
            ],
            'available_questions' => [
                'by_difficulty' => $difficultyBreakdown,
                'by_marks' => $marksBreakdown,
            ],
        ]);
    }
}
