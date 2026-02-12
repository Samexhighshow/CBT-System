<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptEvent;
use App\Models\ExamAttemptSession;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Student;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CbtInterfaceController extends Controller
{
    public function exams(Request $request): JsonResponse
    {
        $student = null;
        $regNumber = strtoupper((string) $request->query('reg_number', ''));

        if ($regNumber !== '') {
            $student = Student::where('registration_number', $regNumber)->first();
        }

        $now = now();

        $exams = Exam::with(['subject:id,name', 'schoolClass:id,name'])
            ->where('published', true)
            ->whereIn('status', ['scheduled', 'active'])
            ->where(function ($query) use ($now) {
                $query->whereNull('end_datetime')
                    ->whereNull('end_time')
                    ->orWhere('end_datetime', '>=', $now)
                    ->orWhere('end_time', '>=', $now);
            })
            ->orderByRaw('COALESCE(start_datetime, start_time) asc')
            ->get();

        $payload = $exams->map(function (Exam $exam) use ($student) {
            $start = $exam->start_datetime ?? $exam->start_time;
            $end = $exam->end_datetime ?? $exam->end_time;

            $canAccess = true;
            $reason = null;

            if ($student) {
                $eligibility = $exam->checkEligibility($student);
                $canAccess = (bool) ($eligibility['eligible'] ?? false);
                $reason = $eligibility['message'] ?? null;
            }

            return [
                'id' => $exam->id,
                'title' => $exam->title,
                'subject' => $exam->subject?->name,
                'class_level' => $exam->schoolClass?->name,
                'duration_minutes' => $exam->duration_minutes,
                'status' => $exam->status,
                'start_datetime' => $start?->toDateTimeString(),
                'end_datetime' => $end?->toDateTimeString(),
                'can_access' => $canAccess,
                'reason' => $reason,
            ];
        })->values();

        return response()->json(['data' => $payload]);
    }

    public function verify(Request $request, int $examId): JsonResponse
    {
        $validated = $request->validate([
            'reg_number' => 'required|string|max:64',
            'access_code' => 'required|string|max:64',
            'device_id' => 'nullable|string|max:255',
        ]);

        $exam = Exam::with(['subject:id,name', 'schoolClass:id,name'])->findOrFail($examId);
        $student = Student::where('registration_number', strtoupper($validated['reg_number']))->first();

        if (!$student) {
            return response()->json([
                'message' => 'Student not found for the supplied registration number.',
            ], 404);
        }

        $access = ExamAccess::where('exam_id', $exam->id)
            ->where('access_code', strtoupper($validated['access_code']))
            ->first();

        if (!$access) {
            return response()->json([
                'message' => 'Invalid access code for this exam.',
            ], 403);
        }

        if (!$this->accessMatchesStudent($access, $student)) {
            return response()->json([
                'message' => 'Access code does not belong to this student.',
            ], 403);
        }

        if ($access->expires_at && $access->expires_at->isPast()) {
            return response()->json([
                'message' => 'This access code has expired.',
            ], 403);
        }

        $activeAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $student->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->latest('id')
            ->first();

        if ($activeAttempt && $activeAttempt->isExpired()) {
            $this->expireAttempt($activeAttempt);
            $activeAttempt = null;
        }

        if ($access->used && !$activeAttempt) {
            return response()->json([
                'message' => 'This access code has already been used.',
            ], 403);
        }

        if (!$activeAttempt) {
            $eligibility = $exam->checkEligibility($student);
            if (!($eligibility['eligible'] ?? false)) {
                return response()->json([
                    'message' => $eligibility['message'] ?? 'Exam access denied.',
                    'reason' => $eligibility['reason'] ?? 'not_eligible',
                    'details' => $eligibility['details'] ?? null,
                ], 403);
            }

            $questionOrder = $this->buildQuestionOrder($exam);
            if (count($questionOrder) === 0) {
                return response()->json([
                    'message' => 'Exam has no questions assigned yet.',
                ], 422);
            }

            $startAt = now();
            $endsAt = $this->computeEndsAt($exam, $startAt);

            $activeAttempt = ExamAttempt::create([
                'attempt_uuid' => (string) Str::uuid(),
                'exam_id' => $exam->id,
                'student_id' => $student->id,
                'device_id' => $validated['device_id'] ?? null,
                'started_at' => $startAt,
                'ends_at' => $endsAt,
                'last_activity_at' => $startAt,
                'question_order' => $questionOrder,
                'status' => 'in_progress',
            ]);

            $this->logEvent($activeAttempt->id, 'attempt_started', [
                'source' => 'cbt_verify',
                'device_id' => $validated['device_id'] ?? null,
            ]);
        }

        if ($activeAttempt->isSubmitted()) {
            return response()->json([
                'message' => 'This attempt has already been submitted.',
            ], 409);
        }

        if ($activeAttempt->isExpired()) {
            $this->expireAttempt($activeAttempt);
            return response()->json([
                'message' => 'Exam time has elapsed for this attempt.',
            ], 409);
        }

        $sessionToken = Str::random(96);
        $sessionTokenHash = hash('sha256', $sessionToken);

        DB::transaction(function () use ($activeAttempt, $sessionTokenHash, $request, $validated, $access) {
            $now = now();

            $replaced = ExamAttemptSession::where('attempt_id', $activeAttempt->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => $now,
                    'revoked_reason' => 'replaced_by_new_login',
                ]);

            if ($replaced > 0) {
                $activeAttempt->increment('switch_count');
                $this->logEvent($activeAttempt->id, 'session_replaced', [
                    'replaced_sessions' => $replaced,
                ]);
            }

            ExamAttemptSession::create([
                'attempt_id' => $activeAttempt->id,
                'session_token_hash' => $sessionTokenHash,
                'device_id' => $validated['device_id'] ?? null,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 2000),
                'is_active' => true,
                'started_at' => $now,
                'last_seen_at' => $now,
            ]);

            $activeAttempt->update([
                'device_id' => $validated['device_id'] ?? $activeAttempt->device_id,
                'last_activity_at' => $now,
                'status' => 'in_progress',
            ]);

            if (!$access->used) {
                $access->markAsUsed();
            }
        });

        $remainingSeconds = max(0, now()->diffInSeconds($activeAttempt->ends_at, false));

        return response()->json([
            'message' => 'Access verified successfully.',
            'data' => [
                'attempt_id' => $activeAttempt->id,
                'session_token' => $sessionToken,
                'ends_at' => $activeAttempt->ends_at?->toIso8601String(),
                'remaining_seconds' => $remainingSeconds,
                'switch_count' => $activeAttempt->switch_count,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'subject' => $exam->subject?->name,
                    'class_level' => $exam->schoolClass?->name,
                    'duration_minutes' => $exam->duration_minutes,
                ],
                'student' => [
                    'id' => $student->id,
                    'registration_number' => $student->registration_number,
                    'name' => trim($student->first_name . ' ' . $student->last_name),
                ],
            ],
        ]);
    }

    public function state(Request $request, int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::with(['exam.subject:id,name', 'exam.schoolClass:id,name'])
            ->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isExpired()) {
            $this->expireAttempt($attempt);
            $attempt->refresh();
        }

        $answers = ExamAnswer::where('attempt_id', $attempt->id)->get()->map(function (ExamAnswer $answer) {
            return [
                'question_id' => $answer->question_id,
                'option_id' => $answer->option_id,
                'answer_text' => $answer->answer_text,
                'flagged' => (bool) $answer->flagged,
                'saved_at' => optional($answer->saved_at)->toIso8601String(),
                'marks_awarded' => $answer->marks_awarded,
            ];
        })->values();

        $remainingSeconds = $attempt->ends_at ? max(0, now()->diffInSeconds($attempt->ends_at, false)) : 0;

        return response()->json([
            'data' => [
                'attempt_id' => $attempt->id,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at?->toIso8601String(),
                'ends_at' => $attempt->ends_at?->toIso8601String(),
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'remaining_seconds' => $remainingSeconds,
                'switch_count' => $attempt->switch_count,
                'tab_warning_count' => $this->tabWarningCount($attempt->id),
                'tab_warning_limit' => $this->tabWarningLimit(),
                'score' => $attempt->score,
                'exam' => [
                    'id' => $attempt->exam?->id,
                    'title' => $attempt->exam?->title,
                    'subject' => $attempt->exam?->subject?->name,
                    'class_level' => $attempt->exam?->schoolClass?->name,
                    'duration_minutes' => $attempt->exam?->duration_minutes,
                ],
                'answers' => $answers,
                'question_order' => $attempt->question_order ?? [],
            ],
        ]);
    }

    public function questions(Request $request, int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::with('exam:id,title,randomize_options')->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        $questionIds = collect($attempt->question_order ?: [])->map(fn ($id) => (int) $id)->filter()->values();

        if ($questionIds->isEmpty()) {
            $questionIds = $attempt->exam->questions()->orderBy('id')->pluck('id');
            $attempt->question_order = $questionIds->values()->all();
            $attempt->save();
        }

        $questions = Question::with('options')
            ->whereIn('id', $questionIds)
            ->get()
            ->keyBy('id');

        $ordered = $questionIds->map(function (int $id) use ($questions) {
            /** @var Question|null $question */
            $question = $questions->get($id);
            if (!$question) {
                return null;
            }

            $options = $question->options
                ->sortBy(fn ($opt) => [$opt->order_index ?? 0, $opt->id])
                ->values()
                ->map(fn ($opt) => [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                ]);

            return [
                'id' => $question->id,
                'question_text' => $question->question_text,
                'question_type' => $question->question_type,
                'marks' => (int) ($question->marks ?? 1),
                'max_words' => $question->max_words,
                'options' => $options,
            ];
        })->filter()->values();

        return response()->json(['data' => $ordered]);
    }

    public function answer(Request $request, int $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'question_id' => 'required|integer|exists:exam_questions,id',
            'option_id' => 'nullable|integer|exists:question_options,id',
            'answer_text' => 'nullable|string',
            'flagged' => 'nullable|boolean',
        ]);

        $attempt = ExamAttempt::with('exam:id')->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isSubmitted()) {
            return response()->json(['message' => 'Attempt already submitted.'], 409);
        }

        if ($attempt->isExpired()) {
            $this->expireAttempt($attempt);
            return response()->json(['message' => 'Attempt time has elapsed.'], 409);
        }

        $questionId = (int) $validated['question_id'];
        $questionOrder = collect($attempt->question_order ?: []);

        if (!$questionOrder->contains($questionId)) {
            return response()->json(['message' => 'Question is not part of this attempt.'], 422);
        }

        $question = Question::findOrFail($questionId);

        $hasAnswerPayload = !empty($validated['option_id']) || !empty($validated['answer_text']);
        $hasFlagPayload = array_key_exists('flagged', $validated);

        if (!$hasAnswerPayload && !$hasFlagPayload) {
            return response()->json(['message' => 'Either option_id or answer_text is required.'], 422);
        }

        if (!empty($validated['option_id'])) {
            $validOption = QuestionOption::where('id', $validated['option_id'])
                ->where('question_id', $questionId)
                ->exists();

            if (!$validOption) {
                return response()->json(['message' => 'Selected option is invalid for this question.'], 422);
            }
        }

        $now = now();

        $answer = ExamAnswer::updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $questionId],
            [
                'option_id' => $validated['option_id'] ?? null,
                'answer_text' => $validated['answer_text'] ?? null,
                'flagged' => (bool) ($validated['flagged'] ?? false),
                'saved_at' => $now,
            ]
        );

        if ($this->isObjectiveQuestion($question) && !empty($validated['option_id'])) {
            $option = QuestionOption::find($validated['option_id']);
            $isCorrect = (bool) ($option?->is_correct ?? false);
            $answer->is_correct = $isCorrect;
            $answer->marks_awarded = $isCorrect ? (float) ($question->marks ?? 1) : 0;
            $answer->save();
        }

        $attempt->update([
            'last_activity_at' => $now,
            'status' => 'in_progress',
        ]);

        /** @var ExamAttemptSession $session */
        $session->update(['last_seen_at' => $now]);

        return response()->json([
            'message' => 'Answer saved.',
            'data' => [
                'question_id' => $questionId,
                'saved_at' => $now->toIso8601String(),
                'flagged' => (bool) ($validated['flagged'] ?? false),
            ],
        ]);
    }

    public function ping(Request $request, int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isExpired()) {
            $this->expireAttempt($attempt);
            return response()->json([
                'message' => 'Attempt expired.',
                'status' => 'expired',
            ], 409);
        }

        $now = now();
        /** @var ExamAttemptSession $session */
        $session->update(['last_seen_at' => $now]);
        $attempt->update(['last_activity_at' => $now]);

        return response()->json([
            'status' => 'ok',
            'remaining_seconds' => max(0, $now->diffInSeconds($attempt->ends_at, false)),
        ]);
    }

    public function event(Request $request, int $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'event_type' => 'required|string|max:100',
            'meta' => 'nullable|array',
        ]);

        $attempt = ExamAttempt::findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isSubmitted()) {
            return response()->json([
                'message' => 'Attempt already submitted.',
            ], 409);
        }

        if ($attempt->isExpired()) {
            $this->expireAttempt($attempt);
            return response()->json([
                'message' => 'Attempt time has elapsed.',
            ], 409);
        }

        $allowedEvents = [
            'tab_hidden',
            'tab_visible',
            'window_blur',
            'window_focus',
            'fullscreen_exited',
            'fullscreen_entered',
            'context_menu_blocked',
            'keyboard_shortcut_blocked',
            'copy_attempt',
            'paste_attempt',
            'cut_attempt',
            'connection_lost',
            'connection_restored',
            'session_resumed',
            'answer_saved',
            'flag_toggled',
        ];

        $eventType = (string) $validated['event_type'];

        if (!in_array($eventType, $allowedEvents, true)) {
            return response()->json([
                'message' => 'Unsupported event type.',
            ], 422);
        }

        $now = now();
        /** @var ExamAttemptSession $session */
        $session->update(['last_seen_at' => $now]);
        $attempt->update(['last_activity_at' => $now]);

        $meta = array_merge(
            $validated['meta'] ?? [],
            [
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ]
        );

        $this->logEvent($attempt->id, $eventType, $meta);

        $tabWarningCount = $this->tabWarningCount($attempt->id);
        $tabWarningLimit = $this->tabWarningLimit();

        if ($this->isTabWarningEvent($eventType) && $tabWarningCount >= $tabWarningLimit) {
            $result = $this->finalizeAttempt($attempt, 'auto_submitted_tab_fencing');

            ExamAttemptSession::where('attempt_id', $attempt->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => $now,
                    'revoked_reason' => 'tab_fencing_limit',
                ]);

            $this->logEvent($attempt->id, 'tab_fencing_limit_reached', [
                'warning_count' => $tabWarningCount,
                'warning_limit' => $tabWarningLimit,
            ]);

            return response()->json([
                'message' => 'Tab-fencing limit reached. Attempt was auto-submitted.',
                'code' => 'auto_submitted_tab_fencing',
                'data' => array_merge($result, [
                    'tab_warning_count' => $tabWarningCount,
                    'tab_warning_limit' => $tabWarningLimit,
                ]),
            ], 409);
        }

        return response()->json([
            'message' => 'Event logged.',
            'data' => [
                'attempt_id' => $attempt->id,
                'event_type' => $eventType,
                'tab_warning_count' => $tabWarningCount,
                'tab_warning_limit' => $tabWarningLimit,
                'logged_at' => $now->toIso8601String(),
            ],
        ]);
    }

    public function submit(Request $request, int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::with('exam')->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isSubmitted()) {
            return response()->json([
                'message' => 'Attempt already submitted.',
                'data' => [
                    'status' => $attempt->status,
                    'score' => $attempt->score,
                ],
            ]);
        }

        $result = $this->finalizeAttempt($attempt, 'submitted_by_student');

        ExamAttemptSession::where('attempt_id', $attempt->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'ended_at' => now(),
                'revoked_reason' => 'submitted',
            ]);

        return response()->json([
            'message' => 'Attempt submitted successfully.',
            'data' => $result,
        ]);
    }

    private function validateSession(Request $request, ExamAttempt $attempt): ExamAttemptSession|JsonResponse
    {
        $sessionToken = (string) $request->header('X-CBT-Session', '');
        if ($sessionToken === '') {
            return response()->json([
                'message' => 'Missing session token.',
                'code' => 'missing_session_token',
            ], 401);
        }

        $sessionHash = hash('sha256', $sessionToken);

        $session = ExamAttemptSession::where('attempt_id', $attempt->id)
            ->where('session_token_hash', $sessionHash)
            ->latest('id')
            ->first();

        if (!$session) {
            return response()->json([
                'message' => 'Invalid session token.',
                'code' => 'invalid_session',
            ], 401);
        }

        if (!$session->is_active) {
            if ($session->revoked_reason === 'tab_fencing_limit') {
                return response()->json([
                    'message' => 'Attempt auto-submitted after tab-fencing violations.',
                    'code' => 'auto_submitted_tab_fencing',
                ], 409);
            }

            if ($session->revoked_reason === 'submitted') {
                return response()->json([
                    'message' => 'Attempt has been submitted.',
                    'code' => 'attempt_submitted',
                ], 409);
            }

            return response()->json([
                'message' => 'Session moved to another device.',
                'code' => 'session_revoked',
            ], 409);
        }

        return $session;
    }

    private function buildQuestionOrder(Exam $exam): array
    {
        $query = $exam->questions()->select('id');

        if ($exam->randomize_questions) {
            $query->inRandomOrder();
        } else {
            $query->orderBy('order_index')->orderBy('id');
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    private function computeEndsAt(Exam $exam, Carbon $startedAt): Carbon
    {
        $durationEnd = $startedAt->copy()->addMinutes(max(1, (int) ($exam->duration_minutes ?? 60)));
        $scheduleEnd = $exam->end_datetime ?? $exam->end_time;

        if ($scheduleEnd instanceof Carbon && $scheduleEnd->lt($durationEnd)) {
            return $scheduleEnd->copy();
        }

        return $durationEnd;
    }

    private function accessMatchesStudent(ExamAccess $access, Student $student): bool
    {
        if ((int) $access->student_id === (int) $student->id) {
            return true;
        }

        if (!empty($access->student_reg_number)) {
            return strtoupper((string) $access->student_reg_number) === strtoupper((string) $student->registration_number);
        }

        return false;
    }

    private function expireAttempt(ExamAttempt $attempt): void
    {
        if ($attempt->isSubmitted()) {
            return;
        }

        $this->finalizeAttempt($attempt, 'auto_timeout');

        if ($attempt->status !== 'completed' && $attempt->status !== 'submitted') {
            $attempt->update(['status' => 'expired']);
        }

        ExamAttemptSession::where('attempt_id', $attempt->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'ended_at' => now(),
                'revoked_reason' => 'attempt_expired',
            ]);
    }

    private function finalizeAttempt(ExamAttempt $attempt, string $eventType): array
    {
        $questionIds = collect($attempt->question_order ?: []);
        if ($questionIds->isEmpty()) {
            $questionIds = $attempt->exam->questions()->orderBy('id')->pluck('id');
        }

        $questions = Question::with('options')
            ->whereIn('id', $questionIds)
            ->get()
            ->keyBy('id');

        $answers = ExamAnswer::where('attempt_id', $attempt->id)->get()->keyBy('question_id');

        $totalMarks = 0.0;
        $totalScore = 0.0;
        $pendingManual = 0;

        foreach ($questionIds as $questionId) {
            /** @var Question|null $question */
            $question = $questions->get((int) $questionId);
            if (!$question) {
                continue;
            }

            $marks = (float) ($question->marks ?? 1);
            $totalMarks += $marks;

            /** @var ExamAnswer|null $answer */
            $answer = $answers->get((int) $questionId);
            if (!$answer) {
                continue;
            }

            if ($this->isObjectiveQuestion($question)) {
                $isCorrect = false;

                if ($answer->option_id) {
                    $isCorrect = (bool) $question->options->where('id', $answer->option_id)->first()?->is_correct;
                }

                $awarded = $isCorrect ? $marks : 0.0;

                $answer->update([
                    'is_correct' => $isCorrect,
                    'marks_awarded' => $awarded,
                    'saved_at' => $answer->saved_at ?? now(),
                ]);

                $totalScore += $awarded;
                continue;
            }

            if ($answer->marks_awarded !== null) {
                $totalScore += (float) $answer->marks_awarded;
            } else {
                $pendingManual++;
            }
        }

        $now = now();
        $status = $pendingManual > 0 ? 'submitted' : 'completed';

        $attempt->update([
            'status' => $status,
            'score' => round($totalScore, 2),
            'ended_at' => $now,
            'submitted_at' => $now,
            'completed_at' => $status === 'completed' ? $now : $attempt->completed_at,
            'last_activity_at' => $now,
            'duration_seconds' => $attempt->started_at ? $attempt->started_at->diffInSeconds($now) : null,
        ]);

        $this->logEvent($attempt->id, $eventType, [
            'status' => $status,
            'score' => round($totalScore, 2),
            'total_marks' => round($totalMarks, 2),
            'pending_manual' => $pendingManual,
        ]);

        return [
            'attempt_id' => $attempt->id,
            'status' => $status,
            'score' => round($totalScore, 2),
            'total_marks' => round($totalMarks, 2),
            'pending_manual_questions' => $pendingManual,
            'submitted_at' => $now->toIso8601String(),
        ];
    }

    private function isObjectiveQuestion(Question $question): bool
    {
        return in_array($question->question_type, [
            'multiple_choice_single',
            'multiple_choice_multiple',
            'true_false',
            'mcq',
        ], true);
    }

    private function isTabWarningEvent(string $eventType): bool
    {
        return in_array($eventType, ['tab_hidden', 'window_blur', 'fullscreen_exited'], true);
    }

    private function tabWarningLimit(): int
    {
        $limit = (int) SystemSetting::get('cbt_tab_fencing_max_violations', 3);
        return max(1, $limit);
    }

    private function tabWarningCount(int $attemptId): int
    {
        return ExamAttemptEvent::where('attempt_id', $attemptId)
            ->whereIn('event_type', ['tab_hidden', 'window_blur', 'fullscreen_exited'])
            ->count();
    }

    private function logEvent(int $attemptId, string $eventType, array $meta = []): void
    {
        ExamAttemptEvent::create([
            'attempt_id' => $attemptId,
            'event_type' => $eventType,
            'meta_json' => $meta,
            'created_at' => now(),
        ]);
    }
}
