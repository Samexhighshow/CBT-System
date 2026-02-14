<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptEvent;
use App\Models\ExamAttemptSession;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MarkingController extends Controller
{
    public function exams(): JsonResponse
    {
        $exams = Exam::with(['subject:id,name', 'schoolClass:id,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Exam $exam) {
                $attempts = ExamAttempt::where('exam_id', $exam->id)->get();

                $pendingAttempts = $attempts->where('status', 'submitted')->count();
                $completedAttempts = $attempts->where('status', 'completed')->count();

                return [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'subject' => $exam->subject?->name,
                    'class_level' => $exam->schoolClass?->name,
                    'pending_marking' => $pendingAttempts,
                    'completed_marking' => $completedAttempts,
                    'total_attempts' => $attempts->count(),
                ];
            });

        return response()->json(['data' => $exams]);
    }

    public function attempts(int $examId): JsonResponse
    {
        $exam = Exam::findOrFail($examId);

        $attempts = ExamAttempt::with('student:id,registration_number,first_name,last_name,class_level')
            ->where('exam_id', $examId)
            ->orderByRaw("CASE WHEN status = 'submitted' THEN 0 ELSE 1 END")
            ->orderByDesc('updated_at')
            ->get()
            ->map(function (ExamAttempt $attempt) {
                [$answeredCount, $pendingCount] = $this->attemptQuestionStats($attempt);

                return [
                    'id' => $attempt->id,
                    'status' => $attempt->status,
                    'score' => $attempt->score,
                    'switch_count' => $attempt->switch_count,
                    'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                    'completed_at' => $attempt->completed_at?->toIso8601String(),
                    'student' => [
                        'id' => $attempt->student?->id,
                        'registration_number' => $attempt->student?->registration_number,
                        'name' => $attempt->student ? trim($attempt->student->first_name . ' ' . $attempt->student->last_name) : 'Unknown',
                        'class_level' => $attempt->student?->class_level,
                    ],
                    'answered_count' => $answeredCount,
                    'pending_manual_count' => $pendingCount,
                    'security_summary' => $this->securitySummary($attempt->id, (int) ($attempt->switch_count ?? 0)),
                ];
            });

        return response()->json([
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'total_marks' => $exam->questions()->sum('marks'),
            ],
            'data' => $attempts,
        ]);
    }

    public function attempt(int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::with([
            'exam:id,title',
            'student:id,registration_number,first_name,last_name,class_level',
            'examAnswers.question.options',
            'examAnswers.option',
        ])->findOrFail($attemptId);

        $questionIds = collect($attempt->question_order ?: []);
        if ($questionIds->isEmpty()) {
            $questionIds = $attempt->exam->questions()->pluck('id');
        }

        $answersByQuestion = $attempt->examAnswers->keyBy('question_id');

        $questions = Question::with(['options', 'bankQuestion'])
            ->whereIn('id', $questionIds)
            ->get()
            ->keyBy('id');

        $payloadQuestions = $questionIds->map(function ($qid) use ($questions, $answersByQuestion) {
            $questionId = (int) $qid;
            $question = $questions->get($questionId);
            if (!$question) {
                return null;
            }

            /** @var ExamAnswer|null $answer */
            $answer = $answersByQuestion->get($questionId);

            $correctOptionIds = $question->options
                ->where('is_correct', true)
                ->pluck('id')
                ->values()
                ->all();

            return [
                'question_id' => $questionId,
                'question_text' => trim((string) ($question->question_text ?? '')) !== ''
                    ? $question->question_text
                    : ($question->bankQuestion?->question_text ?? ''),
                'question_type' => $this->resolveQuestionType($question),
                'marks' => (float) ($question->marks ?? 1),
                'requires_manual_marking' => $this->requiresManualMarking($question),
                'options' => $question->options->map(fn ($opt) => [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                ])->values(),
                'correct_option_ids' => $correctOptionIds,
                'answer' => [
                    'id' => $answer?->id,
                    'option_id' => $answer?->option_id,
                    'option_ids' => $answer ? $this->extractSelectedOptionIds($answer) : [],
                    'answer_text' => $answer?->answer_text,
                    'flagged' => (bool) ($answer?->flagged ?? false),
                    'is_correct' => $answer?->is_correct,
                    'marks_awarded' => $answer?->marks_awarded,
                    'feedback' => $answer?->feedback,
                    'reviewed_at' => $answer?->reviewed_at?->toIso8601String(),
                ],
            ];
        })->filter()->values();

        [$answeredCount, $pendingCount] = $this->attemptQuestionStats($attempt);
        $securitySummary = $this->securitySummary($attempt->id, (int) ($attempt->switch_count ?? 0));
        $recentEvents = $this->recentSecurityEvents($attempt->id);

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'status' => $attempt->status,
                'score' => $attempt->score,
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'completed_at' => $attempt->completed_at?->toIso8601String(),
                'student' => [
                    'id' => $attempt->student?->id,
                    'registration_number' => $attempt->student?->registration_number,
                    'name' => $attempt->student ? trim($attempt->student->first_name . ' ' . $attempt->student->last_name) : 'Unknown',
                    'class_level' => $attempt->student?->class_level,
                ],
                'exam' => [
                    'id' => $attempt->exam?->id,
                    'title' => $attempt->exam?->title,
                ],
                'answered_count' => $answeredCount,
                'pending_manual_count' => $pendingCount,
                'security_summary' => $securitySummary,
            ],
            'questions' => $payloadQuestions,
            'recent_events' => $recentEvents,
        ]);
    }

    public function scoreQuestion(Request $request, int $attemptId, int $questionId): JsonResponse
    {
        $validated = $request->validate([
            'marks_awarded' => 'required|numeric|min:0',
            'feedback' => 'nullable|string',
        ]);

        $attempt = ExamAttempt::with('examAnswers')->findOrFail($attemptId);
        $question = Question::findOrFail($questionId);

        $answer = ExamAnswer::where('attempt_id', $attemptId)
            ->where('question_id', $questionId)
            ->first();

        if (!$answer) {
            return response()->json(['message' => 'No answer found for this question in the attempt.'], 404);
        }

        $maxMarks = (float) ($question->marks ?? 1);
        $awarded = min($maxMarks, (float) $validated['marks_awarded']);

        $answer->update([
            'marks_awarded' => $awarded,
            'feedback' => $validated['feedback'] ?? null,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
            'is_correct' => $awarded >= $maxMarks,
        ]);

        $recalculated = $this->recalculateAttemptScore($attempt->fresh());

        return response()->json([
            'message' => 'Question score updated.',
            'data' => $recalculated,
        ]);
    }

    public function finalize(int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::findOrFail($attemptId);

        $result = $this->recalculateAttemptScore($attempt, true);

        if ($result['pending_manual_count'] > 0) {
            return response()->json([
                'message' => 'Cannot finalize attempt while manual marking is still pending.',
                'data' => $result,
            ], 422);
        }

        return response()->json([
            'message' => 'Attempt marking finalized.',
            'data' => $result,
        ]);
    }

    public function clearAttempt(int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::with(['student:id,registration_number,first_name,last_name', 'exam:id,title'])
            ->findOrFail($attemptId);

        DB::transaction(function () use ($attempt) {
            ExamAnswer::where('attempt_id', $attempt->id)->delete();
            ExamAttemptSession::where('attempt_id', $attempt->id)->delete();
            ExamAttemptEvent::where('attempt_id', $attempt->id)->delete();
            $attempt->delete();
        });

        return response()->json([
            'message' => 'Attempt cleared successfully. Student can restart with a fresh attempt.',
            'data' => [
                'attempt_id' => $attemptId,
                'student_id' => $attempt->student?->id,
                'student_reg_number' => $attempt->student?->registration_number,
                'exam_id' => $attempt->exam?->id,
                'exam_title' => $attempt->exam?->title,
            ],
        ]);
    }

    private function attemptQuestionStats(ExamAttempt $attempt): array
    {
        $answers = ExamAnswer::with('question:id,question_type')
            ->where('attempt_id', $attempt->id)
            ->get();

        $answeredCount = $answers->count();

        $pendingCount = $answers->filter(function (ExamAnswer $answer) {
            if (!$answer->question) {
                return false;
            }

            return $this->requiresManualMarking($answer->question) && $answer->marks_awarded === null;
        })->count();

        return [$answeredCount, $pendingCount];
    }

    private function recalculateAttemptScore(ExamAttempt $attempt, bool $finalize = false): array
    {
        $answers = ExamAnswer::with('question:id,marks,question_type')
            ->where('attempt_id', $attempt->id)
            ->get();

        $score = 0.0;
        $totalMarks = 0.0;
        $pendingManual = 0;

        foreach ($answers as $answer) {
            $marks = (float) ($answer->question?->marks ?? 1);
            $totalMarks += $marks;

            if ($this->requiresManualMarking($answer->question) && $answer->marks_awarded === null) {
                $pendingManual++;
                continue;
            }

            $score += (float) ($answer->marks_awarded ?? 0);
        }

        $status = $pendingManual > 0 ? 'submitted' : 'completed';

        $attempt->update([
            'score' => round($score, 2),
            'status' => $status,
            'completed_at' => $status === 'completed' ? now() : null,
        ]);

        return [
            'attempt_id' => $attempt->id,
            'status' => $status,
            'score' => round($score, 2),
            'total_marks' => round($totalMarks, 2),
            'pending_manual_count' => $pendingManual,
            'finalized' => $finalize && $pendingManual === 0,
        ];
    }

    private function requiresManualMarking(?Question $question): bool
    {
        if (!$question) {
            return false;
        }

        return !in_array($this->resolveQuestionType($question), [
            'multiple_choice',
            'multiple_choice_single',
            'multiple_select',
            'multiple_choice_multiple',
            'true_false',
            'mcq',
        ], true);
    }

    private function resolveQuestionType(Question $question): string
    {
        $bankType = strtolower(trim((string) ($question->bankQuestion?->question_type ?? '')));
        if ($bankType !== '') {
            return $bankType;
        }

        return strtolower(trim((string) ($question->question_type ?? '')));
    }

    private function extractSelectedOptionIds(ExamAnswer $answer): array
    {
        $selected = [];
        if ($answer->option_id) {
            $selected[] = (int) $answer->option_id;
        }

        $text = trim((string) ($answer->answer_text ?? ''));
        if ($text !== '') {
            $decoded = json_decode($text, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $raw = $decoded['option_ids'] ?? $decoded['selected_option_ids'] ?? null;
                if (is_array($raw)) {
                    $selected = array_merge($selected, $raw);
                }
            }
        }

        $normalized = collect($selected)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
        sort($normalized);
        return $normalized;
    }

    private function securitySummary(int $attemptId, int $switchCount = 0): array
    {
        $tabWarnings = ExamAttemptEvent::where('attempt_id', $attemptId)
            ->whereIn('event_type', ['tab_hidden', 'window_blur', 'fullscreen_exited'])
            ->count();

        $blockedActions = ExamAttemptEvent::where('attempt_id', $attemptId)
            ->whereIn('event_type', ['context_menu_blocked', 'keyboard_shortcut_blocked', 'copy_attempt', 'paste_attempt', 'cut_attempt'])
            ->count();

        $totalEvents = ExamAttemptEvent::where('attempt_id', $attemptId)->count();

        $lastViolation = ExamAttemptEvent::where('attempt_id', $attemptId)
            ->whereIn('event_type', ['tab_hidden', 'window_blur', 'fullscreen_exited'])
            ->orderByDesc('created_at')
            ->first(['created_at']);

        return [
            'tab_warning_count' => $tabWarnings,
            'blocked_action_count' => $blockedActions,
            'session_replace_count' => $switchCount,
            'total_events' => $totalEvents,
            'last_violation_at' => $lastViolation?->created_at?->toIso8601String(),
        ];
    }

    private function recentSecurityEvents(int $attemptId): array
    {
        return ExamAttemptEvent::where('attempt_id', $attemptId)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(function (ExamAttemptEvent $event) {
                return [
                    'event_type' => $event->event_type,
                    'meta' => $event->meta_json ?? [],
                    'created_at' => $event->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }
}
