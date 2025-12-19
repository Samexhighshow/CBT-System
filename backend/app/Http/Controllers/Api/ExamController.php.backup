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
        // Align with schema: Exam has questions, published flag, and string department
        $query = Exam::with(['questions']);

        // Filter by subject
        // No subject_id column in current schema

        // Filter by status
        if ($request->has('published')) {
            $query->where('published', (bool)$request->published);
        }

        // Filter by department
        if ($request->has('department')) {
            $query->where('department', $request->department);
        }

        // Pagination
        $perPage = $request->input('limit', 15);
        $exams = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $exams->items(),
            'current_page' => $exams->currentPage(),
            'last_page' => $exams->lastPage(),
            'per_page' => $exams->perPage(),
            'total' => $exams->total(),
            'next_page' => $exams->currentPage() < $exams->lastPage() ? $exams->currentPage() + 1 : null,
            'prev_page' => $exams->currentPage() > 1 ? $exams->currentPage() - 1 : null,
        ]);
    }

    /**
     * Display the specified exam
     */
    public function show($id)
    {
        $exam = Exam::with(['questions.options'])->findOrFail($id);
        
        return response()->json($exam);
    }

    /**
     * Store a newly created exam
     */
    public function store(Request $request)
    {
        // Accept legacy/front-end fields and map to current schema
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'class_level' => 'sometimes|string',
            'department' => 'nullable|string',
            'duration' => 'sometimes|integer|min:1',
            'duration_minutes' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:draft,published,archived',
            'published' => 'sometimes|boolean',
            'total_marks' => 'sometimes|integer|min:0',
            'passing_marks' => 'sometimes|integer|min:0',
            'start_time' => 'sometimes|date',
            'end_time' => 'sometimes|date|after:start_time',
            'metadata' => 'sometimes|array',
            'subject_id' => 'nullable|exists:subjects,id',
        ]);
        
        // Verify at least one question exists for the subject if provided
        if (!empty($validated['subject_id'])) {
            $questionCount = \App\Models\Question::where('subject_id', $validated['subject_id'])->count();
            if ($questionCount === 0) {
                return response()->json([
                    'message' => 'Cannot create exam. No questions exist for the selected subject. Please create questions first.'
                ], 422);
            }
        }

        $payload = [
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'class_level' => $validated['class_level'] ?? ($request->input('class_level') ?? ''),
            'department' => $validated['department'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? ($validated['duration'] ?? 0),
            'published' => isset($validated['published']) ? (bool)$validated['published'] : (($validated['status'] ?? null) === 'published'),
            'metadata' => $validated['metadata'] ?? [
                'total_marks' => $validated['total_marks'] ?? null,
                'passing_marks' => $validated['passing_marks'] ?? null,
                'start_time' => $validated['start_time'] ?? null,
                'end_time' => $validated['end_time'] ?? null,
            ],
        ];

        $exam = Exam::create($payload);

        return response()->json([
            'message' => 'Exam created successfully',
            'exam' => $exam
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
            'class_level' => 'sometimes|string',
            'department' => 'sometimes|string',
            'duration' => 'sometimes|integer|min:1',
            'duration_minutes' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:draft,published,archived',
            'published' => 'sometimes|boolean',
            'total_marks' => 'sometimes|integer|min:0',
            'passing_marks' => 'sometimes|integer|min:0',
            'start_time' => 'sometimes|date',
            'end_time' => 'sometimes|date|after:start_time',
            'metadata' => 'sometimes|array',
            'subject_id' => 'sometimes|integer',
        ]);

        $update = [];
        foreach (['title','description','class_level','department'] as $f) {
            if (array_key_exists($f, $validated)) $update[$f] = $validated[$f];
        }
        if (array_key_exists('duration_minutes', $validated) || array_key_exists('duration', $validated)) {
            $update['duration_minutes'] = $validated['duration_minutes'] ?? $validated['duration'];
        }
        if (array_key_exists('published', $validated) || array_key_exists('status', $validated)) {
            $update['published'] = array_key_exists('published', $validated)
                ? (bool)$validated['published']
                : (($validated['status'] ?? null) === 'published');
        }
        if (array_key_exists('metadata', $validated) || array_key_exists('total_marks', $validated) || array_key_exists('passing_marks', $validated) || array_key_exists('start_time', $validated) || array_key_exists('end_time', $validated)) {
            $meta = is_array($exam->metadata) ? $exam->metadata : [];
            if (array_key_exists('metadata', $validated)) {
                $meta = $validated['metadata'];
            }
            if (array_key_exists('total_marks', $validated)) $meta['total_marks'] = $validated['total_marks'];
            if (array_key_exists('passing_marks', $validated)) $meta['passing_marks'] = $validated['passing_marks'];
            if (array_key_exists('start_time', $validated)) $meta['start_time'] = $validated['start_time'];
            if (array_key_exists('end_time', $validated)) $meta['end_time'] = $validated['end_time'];
            $update['metadata'] = $meta;
        }

        $exam->update($update);

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam
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
        if (!$exam->published) {
            return response()->json(['message' => 'Exam is not available'], 403);
        }

        // Enforce exam scheduled window
        // Scheduled window not enforced (no start/end columns in schema)

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
            'answers.*.question_id' => 'required|exists:exam_questions,id',
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

        // Enforce daily exam window on submission
        $dailyStart = SystemSetting::get('exam_window_start', null);
        $dailyEnd = SystemSetting::get('exam_window_end', null);
        if ($dailyStart && $dailyEnd) {
            $now = now();
            $startToday = $now->copy()->setTimeFromTimeString($dailyStart);
            $endToday = $now->copy()->setTimeFromTimeString($dailyEnd);
            if ($now->lt($startToday) || $now->gt($endToday)) {
                return response()->json(['message' => 'Exam submission is restricted to the daily window: '.$dailyStart.' - '.$dailyEnd], 403);
            }
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

        // Enforce daily exam window from system settings
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
                    $marks = $question->metadata['marks'] ?? 1;
                    $totalScore += is_numeric($marks) ? (int)$marks : 1;
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
            'total_marks' => $exam->metadata['total_marks'] ?? null,
            'passing_marks' => $exam->metadata['passing_marks'] ?? null,
        ]);
    }
}
