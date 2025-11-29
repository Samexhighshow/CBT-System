<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamAnswer;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamController extends Controller
{
    /**
     * Display a listing of exams
     */
    public function index(Request $request)
    {
        $query = Exam::with(['subject', 'departments', 'questions']);

        // Filter by subject
        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by department
        if ($request->has('department_id')) {
            $query->whereHas('departments', function($q) use ($request) {
                $q->where('departments.id', $request->department_id);
            });
        }

        $exams = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($exams);
    }

    /**
     * Display the specified exam
     */
    public function show($id)
    {
        $exam = Exam::with(['subject', 'departments', 'questions.options'])->findOrFail($id);
        
        return response()->json($exam);
    }

    /**
     * Store a newly created exam
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'subject_id' => 'required|exists:subjects,id',
            'duration_minutes' => 'required|integer|min:1',
            'total_marks' => 'required|integer|min:1',
            'passing_marks' => 'required|integer|min:0',
            'start_time' => 'required|date',
            'end_time' => 'required|date|after:start_time',
            'instructions' => 'nullable|string',
            'status' => 'required|in:draft,published,archived',
            'shuffle_questions' => 'boolean',
            'show_results_immediately' => 'boolean',
            'department_ids' => 'required|array',
            'department_ids.*' => 'exists:departments,id',
        ]);

        $departmentIds = $validated['department_ids'];
        unset($validated['department_ids']);

        $exam = Exam::create($validated);
        $exam->departments()->attach($departmentIds);

        return response()->json([
            'message' => 'Exam created successfully',
            'exam' => $exam->load(['subject', 'departments'])
        ], 201);
    }

    /**
     * Update the specified exam
     */
    public function update(Request $request, $id)
    {
        $exam = Exam::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'subject_id' => 'sometimes|exists:subjects,id',
            'duration_minutes' => 'sometimes|integer|min:1',
            'total_marks' => 'sometimes|integer|min:1',
            'passing_marks' => 'sometimes|integer|min:0',
            'start_time' => 'sometimes|date',
            'end_time' => 'sometimes|date|after:start_time',
            'instructions' => 'nullable|string',
            'status' => 'sometimes|in:draft,published,archived',
            'shuffle_questions' => 'boolean',
            'show_results_immediately' => 'boolean',
            'department_ids' => 'sometimes|array',
            'department_ids.*' => 'exists:departments,id',
        ]);

        if (isset($validated['department_ids'])) {
            $exam->departments()->sync($validated['department_ids']);
            unset($validated['department_ids']);
        }

        $exam->update($validated);

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam->load(['subject', 'departments'])
        ]);
    }

    /**
     * Remove the specified exam
     */
    public function destroy($id)
    {
        $exam = Exam::findOrFail($id);
        $exam->delete();

        return response()->json([
            'message' => 'Exam deleted successfully'
        ]);
    }

    /**
     * Start an exam for a student
     */
    public function startExam(Request $request, $id)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
        ]);

        $exam = Exam::with('questions')->findOrFail($id);

        // Check if exam is available
        if ($exam->status !== 'published') {
            return response()->json(['message' => 'Exam is not available'], 403);
        }

        // Enforce exam scheduled window
        if (now() < $exam->start_time || now() > $exam->end_time) {
            return response()->json(['message' => 'Exam is not within the scheduled time window'], 403);
        }

        // Enforce daily exam window from system settings (HH:MM)
        $dailyStart = SystemSetting::get('exam_window_start', null);
        $dailyEnd = SystemSetting::get('exam_window_end', null);
        if ($dailyStart && $dailyEnd) {
            $now = now();
            $startToday = $now->copy()->setTimeFromTimeString($dailyStart);
            $endToday = $now->copy()->setTimeFromTimeString($dailyEnd);
            if ($now->lt($startToday) || $now->gt($endToday)) {
                return response()->json(['message' => 'Exam access is restricted to the daily window: '.$dailyStart.' - '.$dailyEnd], 403);
            }
        }

        // Check if student already has an active attempt
        $existingAttempt = ExamAttempt::where('exam_id', $id)
            ->where('student_id', $validated['student_id'])
            ->where('status', 'in_progress')
            ->first();

        if ($existingAttempt) {
            return response()->json([
                'message' => 'You already have an active attempt for this exam',
                'attempt' => $existingAttempt
            ], 409);
        }

        // Enforce maximum attempts per student
        $maxAttempts = (int) (SystemSetting::get('max_exam_attempts', 0) ?? 0);
        if ($maxAttempts > 0) {
            $completedAttemptsCount = ExamAttempt::where('exam_id', $id)
                ->where('student_id', $validated['student_id'])
                ->whereIn('status', ['completed','submitted'])
                ->count();
            if ($completedAttemptsCount >= $maxAttempts) {
                return response()->json([
                    'message' => 'Maximum allowed attempts ('.$maxAttempts.') reached for this exam.'
                ], 403);
            }
        }

        // Create new attempt
        $attempt = ExamAttempt::create([
            'exam_id' => $id,
            'student_id' => $validated['student_id'],
            'started_at' => now(),
            'status' => 'in_progress',
        ]);

        return response()->json([
            'message' => 'Exam started successfully',
            'attempt' => $attempt,
            'exam' => $exam
        ], 201);
    }

    /**
     * Submit exam answers
     */
    public function submitExam(Request $request, $id)
    {
        $validated = $request->validate([
            'attempt_id' => 'required|exists:exam_attempts,id',
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|exists:questions,id',
            'answers.*.selected_option' => 'nullable|string',
            'answers.*.answer_text' => 'nullable|string',
        ]);

        $attempt = ExamAttempt::findOrFail($validated['attempt_id']);

        if ($attempt->exam_id != $id) {
            return response()->json(['message' => 'Invalid attempt for this exam'], 403);
        }

        if ($attempt->status !== 'in_progress') {
            return response()->json(['message' => 'This exam attempt has already been completed'], 403);
        }

        DB::beginTransaction();
        try {
            // Save answers
            foreach ($validated['answers'] as $answer) {
                ExamAnswer::updateOrCreate(
                    [
                        'attempt_id' => $attempt->id,
                        'question_id' => $answer['question_id'],
                    ],
                    [
                        'selected_option' => $answer['selected_option'] ?? null,
                        'answer_text' => $answer['answer_text'] ?? null,
                    ]
                );
            }

            // Calculate score
            $score = $this->calculateScore($attempt);

            // Update attempt
            $attempt->update([
                'completed_at' => now(),
                'status' => 'completed',
                'score' => $score,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Exam submitted successfully',
                'attempt' => $attempt->load('examAnswers'),
                'score' => $score,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to submit exam', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get exam questions for a student
     */
    public function getQuestions($id, Request $request)
    {
        $validated = $request->validate([
            'attempt_id' => 'required|exists:exam_attempts,id',
        ]);

        $exam = Exam::with('questions.options')->findOrFail($id);
        $attempt = ExamAttempt::findOrFail($validated['attempt_id']);

        if ($attempt->exam_id != $id) {
            return response()->json(['message' => 'Invalid attempt for this exam'], 403);
        }

        // Shuffle questions if enabled
        $questions = $exam->shuffle_questions 
            ? $exam->questions->shuffle() 
            : $exam->questions;

        return response()->json([
            'exam' => $exam,
            'questions' => $questions,
            'attempt' => $attempt,
        ]);
    }

    /**
     * Calculate exam score
     */
    private function calculateScore(ExamAttempt $attempt)
    {
        $totalScore = 0;
        $answers = $attempt->examAnswers()->with('question.options')->get();

        foreach ($answers as $answer) {
            $question = $answer->question;
            
            if ($question->question_type === 'multiple_choice') {
                $correctOption = $question->options->where('is_correct', true)->first();
                if ($correctOption && $answer->selected_option === $correctOption->option_text) {
                    $totalScore += $question->marks;
                }
            }
            // Add scoring logic for other question types if needed
        }

        return $totalScore;
    }

    /**
     * Get exam statistics
     */
    public function getStatistics($id)
    {
        $exam = Exam::with('questions')->findOrFail($id);
        
        $totalAttempts = $exam->attempts()->where('status', 'completed')->count();
        $averageScore = $exam->attempts()
            ->where('status', 'completed')
            ->avg('score') ?? 0;
        
        $highestScore = $exam->attempts()
            ->where('status', 'completed')
            ->max('score') ?? 0;
        
        $lowestScore = $exam->attempts()
            ->where('status', 'completed')
            ->min('score') ?? 0;

        return response()->json([
            'total_attempts' => $totalAttempts,
            'average_score' => round($averageScore, 2),
            'highest_score' => $highestScore,
            'lowest_score' => $lowestScore,
            'total_questions' => $exam->questions->count(),
            'total_marks' => $exam->total_marks,
            'passing_marks' => $exam->passing_marks,
        ]);
    }
}
