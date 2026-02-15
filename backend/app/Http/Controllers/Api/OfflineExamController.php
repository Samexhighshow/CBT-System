<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptEvent;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OfflineExamController extends Controller
{
    /**
     * Offline exam package download (full exam payload).
     */
    public function package(int $examId)
    {
        try {
            $exam = Exam::with(['questions.options', 'subject:id,name', 'schoolClass:id,name'])
                ->findOrFail($examId);

            $packageVersion = $exam->updated_at?->timestamp ?? now()->timestamp;

            $questions = $exam->questions->map(function ($question) {
                return [
                    'id' => $question->id,
                    'question_text' => $question->question_text,
                    'question_type' => $question->question_type,
                    'marks' => (float) ($question->marks ?? 1),
                    'options' => $question->options->map(function ($option) {
                        return [
                            'id' => $option->id,
                            'option_text' => $option->option_text,
                        ];
                    })->values(),
                ];
            })->values();

            return response()->json([
                'examId' => $exam->id,
                'packageVersion' => (string) $packageVersion,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'description' => $exam->description,
                    'duration_minutes' => $exam->duration_minutes,
                    'subject' => $exam->subject,
                    'class_level' => $exam->class_level ?? $exam->schoolClass?->name,
                    'start_datetime' => $exam->start_datetime,
                    'end_datetime' => $exam->end_datetime,
                ],
                'questions' => $questions,
            ]);
        } catch (\Exception $e) {
            Log::error('Offline package error: ' . $e->getMessage());

            return response()->json([
                'message' => 'Failed to load exam package',
            ], 500);
        }
    }

    /**
     * Sync an offline attempt (idempotent).
     */
    public function syncAttempt(Request $request)
    {
        $validated = $request->validate([
            'attemptId' => 'required|string|max:64',
            'examId' => 'required|integer|exists:exams,id',
            'studentId' => 'required|integer|exists:students,id',
            'startedAt' => 'required|date',
            'submittedAt' => 'required|date',
            'answers' => 'required|array|min:1',
            'answers.*.questionId' => 'required|integer',
            'answers.*.answer' => 'required',
            'cheatLogs' => 'nullable|array',
            'receiptCode' => 'nullable|string|max:100',
            'signature' => 'nullable|string',
        ]);

        $signature = (string) ($validated['signature'] ?? '');
        $salt = (string) env('OFFLINE_SYNC_SALT', '');
        if ($salt !== '') {
            $hashPayload = $validated['attemptId']
                . $validated['studentId']
                . $validated['examId']
                . json_encode($validated['answers'])
                . $validated['submittedAt']
                . $salt;

            $expected = hash('sha256', $hashPayload);
            if ($signature === '' || !hash_equals($expected, $signature)) {
                return response()->json([
                    'message' => 'Invalid signature',
                ], 422);
            }
        }

        $existing = ExamAttempt::where('attempt_uuid', $validated['attemptId'])->first();
        if ($existing) {
            return response()->json([
                'message' => 'Attempt already synced',
                'attempt_id' => $existing->id,
            ]);
        }

        $exam = Exam::with(['questions.options'])->findOrFail($validated['examId']);

        DB::beginTransaction();

        try {
            $attempt = ExamAttempt::create([
                'attempt_uuid' => $validated['attemptId'],
                'exam_id' => $exam->id,
                'student_id' => $validated['studentId'],
                'started_at' => $validated['startedAt'],
                'submitted_at' => $validated['submittedAt'],
                'ended_at' => $validated['submittedAt'],
                'status' => 'submitted',
                'synced_at' => now(),
            ]);

            $answersPayload = $validated['answers'];
            $questions = $exam->questions->keyBy('id');
            $score = 0.0;
            $pendingManual = 0;

            foreach ($answersPayload as $answer) {
                $questionId = (int) $answer['questionId'];
                $question = $questions->get($questionId);
                if (!$question) {
                    continue;
                }

                $answerData = $answer['answer'] ?? [];
                $optionId = isset($answerData['optionId']) ? (int) $answerData['optionId'] : null;
                $answerText = $answerData['text'] ?? null;

                $payload = [
                    'attempt_id' => $attempt->id,
                    'question_id' => $questionId,
                    'option_id' => $optionId,
                    'answer_text' => $answerText,
                    'saved_at' => now(),
                ];

                if ($this->requiresManualMarking($question)) {
                    $payload['is_correct'] = null;
                    $payload['marks_awarded'] = null;
                    $pendingManual++;
                } else {
                    $correctOptionIds = $question->options
                        ->where('is_correct', true)
                        ->pluck('id')
                        ->all();
                    $isCorrect = $optionId ? in_array($optionId, $correctOptionIds, true) : false;
                    $marks = (float) ($question->marks ?? 1);
                    $payload['is_correct'] = $isCorrect;
                    $payload['marks_awarded'] = $isCorrect ? $marks : 0.0;
                    $score += (float) $payload['marks_awarded'];
                }

                ExamAnswer::create($payload);
            }

            if (!empty($validated['cheatLogs'])) {
                foreach ($validated['cheatLogs'] as $log) {
                    ExamAttemptEvent::create([
                        'attempt_id' => $attempt->id,
                        'event_type' => $log['eventType'] ?? 'offline_event',
                        'meta_json' => $log,
                        'created_at' => $log['createdAt'] ?? now(),
                    ]);
                }
            }

            $status = $pendingManual > 0 ? 'submitted' : 'completed';
            $attempt->update([
                'status' => $status,
                'score' => round($score, 2),
                'completed_at' => $status === 'completed' ? now() : null,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Attempt synced successfully',
                'attempt_id' => $attempt->id,
                'status' => $status,
                'score' => round($score, 2),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Offline sync error: ' . $e->getMessage());

            return response()->json([
                'message' => 'Failed to sync attempt',
            ], 500);
        }
    }

    /**
     * Sync offline exam submission
     */
    public function syncSubmission(Request $request)
    {
        $request->validate([
            'exam_id' => 'required|integer|exists:exams,id',
            'student_id' => 'required|integer|exists:students,id',
            'answers' => 'required|array',
            'answers.*.question_id' => 'required|integer',
            'answers.*.selected_option_id' => 'required|integer',
            'started_at' => 'required|date',
            'submitted_at' => 'required|date',
            'cheating_events' => 'nullable|array',
        ]);

        try {
            DB::beginTransaction();

            // Check if this submission already exists
            $existingAttempt = ExamAttempt::where('exam_id', $request->exam_id)
                ->where('student_id', $request->student_id)
                ->where('started_at', $request->started_at)
                ->first();

            if ($existingAttempt) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'This exam submission has already been synced',
                    'attempt_id' => $existingAttempt->id,
                ], 409);
            }

            // Create exam attempt
            $attempt = ExamAttempt::create([
                'exam_id' => $request->exam_id,
                'student_id' => $request->student_id,
                'started_at' => $request->started_at,
                'ended_at' => $request->submitted_at,
                'status' => 'completed',
                'cheating_events' => $request->cheating_events ? json_encode($request->cheating_events) : null,
            ]);

            // Save answers
            $correctAnswers = 0;
            $totalQuestions = count($request->answers);

            foreach ($request->answers as $answer) {
                $questionOption = DB::table('question_options')
                    ->where('id', $answer['selected_option_id'])
                    ->first();

                $isCorrect = $questionOption && $questionOption->is_correct;

                ExamAnswer::create([
                    'attempt_id' => $attempt->id,
                    'question_id' => $answer['question_id'],
                    'option_id' => $answer['selected_option_id'],
                    'is_correct' => $isCorrect,
                ]);

                if ($isCorrect) {
                    $correctAnswers++;
                }
            }

            // Calculate score
            $score = $totalQuestions > 0 ? ($correctAnswers / $totalQuestions) * 100 : 0;
            
            $attempt->update([
                'score' => $score,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Exam synced successfully',
                'attempt_id' => $attempt->id,
                'score' => round($score, 2),
                'correct_answers' => $correctAnswers,
                'total_questions' => $totalQuestions,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Offline sync error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to sync exam submission',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Batch sync multiple submissions
     */
    public function batchSync(Request $request)
    {
        $request->validate([
            'submissions' => 'required|array',
            'submissions.*.exam_id' => 'required|integer',
            'submissions.*.student_id' => 'required|integer',
            'submissions.*.answers' => 'required|array',
            'submissions.*.started_at' => 'required|date',
            'submissions.*.submitted_at' => 'required|date',
        ]);

        $results = [];
        $successCount = 0;
        $failCount = 0;

        foreach ($request->submissions as $index => $submission) {
            try {
                $syncRequest = new Request($submission);
                $response = $this->syncSubmission($syncRequest);
                $data = json_decode($response->getContent(), true);

                if ($data['success']) {
                    $successCount++;
                    $results[] = [
                        'index' => $index,
                        'success' => true,
                        'attempt_id' => $data['attempt_id'],
                    ];
                } else {
                    $failCount++;
                    $results[] = [
                        'index' => $index,
                        'success' => false,
                        'message' => $data['message'],
                    ];
                }
            } catch (\Exception $e) {
                $failCount++;
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'success' => $failCount === 0,
            'message' => "Synced $successCount/$successCount submissions",
            'total' => count($request->submissions),
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'results' => $results,
        ]);
    }

    /**
     * Download exam data for offline use
     */
    public function downloadExam($examId)
    {
        try {
            $exam = Exam::with(['questions.options'])->findOrFail($examId);

            // Check if student has access to this exam
            $studentId = auth()->user()->student_id ?? null;
            
            if (!$studentId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Student not found',
                ], 403);
            }

            // Check if exam is published and active
            if (!$exam->published) {
                return response()->json([
                    'success' => false,
                    'message' => 'Exam is not available',
                ], 403);
            }

            return response()->json([
                'success' => true,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'description' => $exam->description,
                    'duration_minutes' => $exam->duration_minutes,
                    'questions' => $exam->questions->map(function ($question) {
                        return [
                            'id' => $question->id,
                            'question_text' => $question->question_text,
                            'question_type' => $question->question_type,
                            'options' => $question->options->map(function ($option) {
                                return [
                                    'id' => $option->id,
                                    'option_text' => $option->option_text,
                                    // Don't send is_correct to client
                                ];
                            }),
                        ];
                    }),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Download exam error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to download exam',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function requiresManualMarking(?Question $question): bool
    {
        if (!$question) {
            return false;
        }

        return !in_array($question->question_type, [
            'multiple_choice_single',
            'multiple_choice_multiple',
            'true_false',
        ], true);
    }

    /**
     * Check sync status
     */
    public function checkSyncStatus(Request $request)
    {
        $request->validate([
            'submission_ids' => 'required|array',
            'submission_ids.*' => 'string', // Client-side generated IDs
        ]);

        // This would require a mapping table for client-side IDs to server attempts
        // For now, return pending status
        return response()->json([
            'success' => true,
            'statuses' => array_fill_keys($request->submission_ids, 'pending'),
        ]);
    }
}
