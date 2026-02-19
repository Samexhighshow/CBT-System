<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptEvent;
use App\Models\ExamAttemptSession;
use App\Models\IdempotencyKey;
use App\Models\Question;
use App\Models\Student;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CbtInterfaceController extends Controller
{
    public function config(): JsonResponse
    {
        $mode = $this->assessmentDisplayMode();

        return response()->json([
            'data' => [
                'mode' => $mode,
                'labels' => $this->assessmentDisplayLabels($mode),
            ],
        ]);
    }

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
                'assessment_type' => $exam->assessment_type,
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

        $mode = $this->assessmentDisplayMode();

        return response()->json([
            'data' => $payload,
            'meta' => [
                'assessment_mode' => $mode,
                'assessment_labels' => $this->assessmentDisplayLabels($mode),
            ],
        ]);
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
            $crossExamAccess = ExamAccess::where('access_code', strtoupper($validated['access_code']))->latest('id')->first();
            if ($crossExamAccess && $this->accessMatchesStudent($crossExamAccess, $student)) {
                $otherExamTitle = Exam::where('id', $crossExamAccess->exam_id)->value('title');
                return response()->json([
                    'message' => $otherExamTitle
                        ? "Access code belongs to a different exam ({$otherExamTitle}). Please select the correct exam."
                        : 'Access code belongs to a different exam. Please select the correct exam.',
                ], 403);
            }

            return response()->json([
                'message' => 'Invalid access code for this exam.',
            ], 403);
        }

        if (strtoupper((string) ($access->status ?? 'NEW')) === 'VOID') {
            return response()->json([
                'message' => 'This access code has been replaced. Request the latest code from supervisor.',
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

        $attemptMode = $this->resolveAttemptMode($exam);

        $activeAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $student->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->where(function ($q) use ($attemptMode) {
                $this->applyAttemptModeScope($q, $attemptMode);
            })
            ->latest('id')
            ->first();

        if ($activeAttempt && $activeAttempt->isExpired()) {
            $this->expireAttempt($activeAttempt);
            $activeAttempt = null;
        }

        $latestAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $student->id)
            ->where(function ($q) use ($attemptMode) {
                $this->applyAttemptModeScope($q, $attemptMode);
            })
            ->latest('id')
            ->first();

        // Allow session replacement: if a new unused access code is provided and there's a previous attempt,
        // void the old attempt to allow a fresh start. This enables re-taking exams with a new access code.
        if (!$activeAttempt && $latestAttempt && !$access->used) {
            $latestStatus = strtolower((string) ($latestAttempt->status ?? ''));
            $latestIsInProgress = in_array($latestStatus, ['pending', 'in_progress'], true);
            $allowRetakes = SystemSetting::get('allow_exam_retakes', '0');

            // Check if this is a new access code (generated after the latest attempt)
            if (
                $latestIsInProgress
                && $access->created_at
                && $latestAttempt->created_at
                && $access->created_at > $latestAttempt->created_at
            ) {
                // Session replacement for an in-progress/pending attempt.
                $latestAttempt->update([
                    'status' => 'voided',
                    'updated_at' => now(),
                ]);
                $latestAttempt = null;
            } else {
                // Old access code or exam retake not allowed
                if ($allowRetakes !== '1' && $allowRetakes !== 1 && $allowRetakes !== true) {
                    return response()->json([
                        'message' => 'Student already has an attempt for this exam. A new token cannot restart it.',
                        'reason' => 'attempt_already_exists',
                        'attempt_status' => $latestAttempt->status,
                    ], 409);
                }
                // If a stale in-progress attempt exists and retake/mode-switch is allowed,
                // void it. Completed/submitted attempts are preserved for compilation history.
                if ($latestIsInProgress) {
                    $latestAttempt->update([
                        'status' => 'voided',
                        'updated_at' => now(),
                    ]);
                    $latestAttempt = null;
                }
            }
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

            $questionSeed = null;
            if (
                strtolower((string) ($exam->question_selection_mode ?? 'fixed')) === 'random'
                || $this->shouldShuffleQuestionOrder($exam)
            ) {
                // Fresh seed per attempt ensures a new randomized selection/order on each restart.
                $questionSeed = Str::random(24);
            }

            $questionOrder = $this->buildQuestionOrder($exam, (int) $student->id, $questionSeed);
            if (count($questionOrder) === 0) {
                return response()->json([
                    'message' => 'Exam has no questions assigned yet.',
                ], 422);
            }

            $activeAttempt = ExamAttempt::create([
                'attempt_uuid' => (string) Str::uuid(),
                'exam_id' => $exam->id,
                'student_id' => $student->id,
                'device_id' => $validated['device_id'] ?? null,
                'started_at' => null,
                'ends_at' => null,
                'last_activity_at' => now(),
                'question_order' => $questionOrder,
                'assessment_mode' => $attemptMode,
                'status' => 'pending',
            ]);

            $this->logEvent($activeAttempt->id, 'attempt_created', [
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
            ]);

            if (!$access->used) {
                $access->markAsUsed();
            }
        });

        $remainingSeconds = $activeAttempt->ends_at
            ? max(0, now()->diffInSeconds($activeAttempt->ends_at, false))
            : max(60, ((int) ($exam->duration_minutes ?? 60)) * 60);

        return response()->json([
            'message' => 'Access verified successfully.',
            'data' => [
                'attempt_id' => $activeAttempt->id,
                'session_token' => $sessionToken,
                'status' => $activeAttempt->status,
                'started_at' => $activeAttempt->started_at?->toIso8601String(),
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

    public function start(Request $request, int $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'client_started_at' => 'nullable|date',
        ]);

        $attempt = ExamAttempt::with(['exam.subject:id,name', 'exam.schoolClass:id,name'])->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isSubmitted()) {
            return response()->json([
                'message' => 'Attempt already submitted.',
                'code' => 'attempt_submitted',
            ], 409);
        }

        if ($attempt->isExpired()) {
            $this->expireAttempt($attempt);
            return response()->json([
                'message' => 'Attempt expired before start.',
                'code' => 'attempt_expired',
            ], 409);
        }

        if ($attempt->status !== 'in_progress') {
            $now = now();
            $examStart = $attempt->exam?->start_datetime ?? $attempt->exam?->start_time;
            $examEnd = $attempt->exam?->end_datetime ?? $attempt->exam?->end_time;
            if ($examStart instanceof Carbon && $now->lt($examStart)) {
                return response()->json([
                    'message' => 'Exam has not started yet.',
                    'code' => 'exam_not_started',
                ], 409);
            }
            if ($examEnd instanceof Carbon && $examEnd->lte($now)) {
                return response()->json([
                    'message' => 'Exam window has already closed.',
                    'code' => 'exam_window_closed',
                ], 409);
            }

            $endsAt = $this->computeEndsAt($attempt->exam, $now);
            if ($endsAt->lte($now)) {
                return response()->json([
                    'message' => 'Exam window has already closed.',
                    'code' => 'exam_window_closed',
                ], 409);
            }

            $attempt->update([
                'started_at' => $attempt->started_at ?? $now,
                'ends_at' => $attempt->ends_at ?? $endsAt,
                'client_started_at' => $attempt->client_started_at ?? ($validated['client_started_at'] ?? null),
                'server_started_at' => $attempt->server_started_at ?? $now,
                'time_anomaly_flag' => $attempt->time_anomaly_flag || $this->isClientTimeAnomalous($validated['client_started_at'] ?? null, $now),
                'time_anomaly_reason' => $attempt->time_anomaly_reason ?: $this->timeAnomalyReason($validated['client_started_at'] ?? null, $now, 'start_clock_skew'),
                'last_activity_at' => $now,
                'status' => 'in_progress',
            ]);

            /** @var ExamAttemptSession $session */
            $session->update(['last_seen_at' => $now]);

            $this->logEvent($attempt->id, 'attempt_started', [
                'source' => 'candidate_start_button',
            ]);
        }

        $attempt->refresh();
        $remainingSeconds = $this->remainingSecondsForAttempt($attempt);

        return response()->json([
            'message' => 'Attempt started.',
            'data' => [
                'attempt_id' => $attempt->id,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at?->toIso8601String(),
                'ends_at' => $attempt->ends_at?->toIso8601String(),
                'remaining_seconds' => $remainingSeconds,
                'exam' => [
                    'id' => $attempt->exam?->id,
                    'title' => $attempt->exam?->title,
                    'subject' => $attempt->exam?->subject?->name,
                    'class_level' => $attempt->exam?->schoolClass?->name,
                    'duration_minutes' => $attempt->exam?->duration_minutes,
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
            $selectedOptionIds = $this->extractSelectedOptionIds($answer);
            return [
                'question_id' => $answer->question_id,
                'option_id' => $answer->option_id,
                'option_ids' => $selectedOptionIds,
                'answer_text' => $answer->answer_text,
                'flagged' => (bool) $answer->flagged,
                'saved_at' => optional($answer->saved_at)->toIso8601String(),
                'marks_awarded' => $answer->marks_awarded,
            ];
        })->values();

        $remainingSeconds = $this->remainingSecondsForAttempt($attempt);

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
        $attempt = ExamAttempt::with('exam:id,title,randomize_options,shuffle_option_order,randomize_questions,shuffle_question_order,question_selection_mode,total_questions_to_serve,question_distribution,difficulty_distribution,marks_distribution,question_reuse_policy')->findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        $questionIds = collect($attempt->question_order ?: [])->map(fn ($id) => (int) $id)->filter()->values();

        if ($questionIds->isEmpty()) {
            $questionIds = collect($this->buildQuestionOrder($attempt->exam, (int) $attempt->student_id));
            $attempt->question_order = $questionIds->values()->all();
            $attempt->save();
        }

        $questions = Question::with(['options', 'bankQuestion.options'])
            ->whereIn('id', $questionIds)
            ->get()
            ->keyBy('id');

        $ordered = $questionIds->map(function (int $id) use ($questions, $attempt) {
            /** @var Question|null $question */
            $question = $questions->get($id);
            if (!$question) {
                return null;
            }

            $options = $this->questionOptionsForAttempt($attempt, $question)
                ->values()
                ->map(fn ($opt) => [
                    'id' => $opt->id,
                    'option_text' => $opt->option_text,
                ]);

            return [
                'id' => $question->id,
                'question_text' => $this->questionText($question),
                'question_type' => $this->questionType($question),
                'marks' => (int) $this->questionMarks($question),
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
            'option_id' => 'nullable|integer',
            'option_ids' => 'nullable|array',
            'option_ids.*' => 'integer',
            'answer_text' => 'nullable|string',
            'flagged' => 'nullable|boolean',
        ]);

        $attempt = ExamAttempt::with('exam:id')->findOrFail($attemptId);

        $idempotencyReplay = $this->resolveIdempotentReplay($request, $attempt->exam_id, $attempt->student_id);
        if ($idempotencyReplay instanceof JsonResponse) {
            return $idempotencyReplay;
        }

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->isSubmitted()) {
            return response()->json(['message' => 'Attempt already submitted.'], 409);
        }

        if ($attempt->status !== 'in_progress' || !$attempt->started_at || !$attempt->ends_at) {
            return response()->json([
                'message' => 'Attempt has not started yet. Click Start Now to begin.',
                'code' => 'attempt_not_started',
            ], 409);
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

        $payload = $request->all();
        $hasOptionIdPayload = array_key_exists('option_id', $payload);
        $hasOptionIdsPayload = array_key_exists('option_ids', $payload);
        $hasAnswerTextPayload = array_key_exists('answer_text', $payload);
        $hasAnswerPayload = $hasOptionIdPayload || $hasOptionIdsPayload || $hasAnswerTextPayload;
        $hasFlagPayload = array_key_exists('flagged', $validated);

        if (!$hasAnswerPayload && !$hasFlagPayload) {
            return response()->json(['message' => 'Provide answer payload (option_id, option_ids, or answer_text).'], 422);
        }

        $now = now();
        $questionType = $this->normalizeQuestionType($question);

        $answer = ExamAnswer::firstOrNew([
            'attempt_id' => $attempt->id,
            'question_id' => $questionId,
        ]);

        if ($this->isMultiSelectQuestion($question)) {
            if ($hasOptionIdsPayload) {
                $selectedIds = $this->normalizeOptionIds($validated['option_ids'] ?? []);

                if (count($selectedIds) > 0 && !$this->areValidOptionsForQuestion($question, $selectedIds)) {
                    return response()->json(['message' => 'One or more selected options are invalid for this question.'], 422);
                }

                $answer->option_id = null;
                $answer->answer_text = count($selectedIds) > 0
                    ? json_encode(['option_ids' => $selectedIds], JSON_UNESCAPED_UNICODE)
                    : null;

                if (count($selectedIds) > 0) {
                    $correctIds = $this->questionOptions($question)
                        ->where('is_correct', true)
                        ->pluck('id')
                        ->map(fn ($id) => (int) $id)
                        ->values()
                        ->all();

                    sort($selectedIds);
                    sort($correctIds);

                    $isCorrect = $selectedIds === $correctIds;
                    $answer->is_correct = $isCorrect;
                    $answer->marks_awarded = $isCorrect ? $this->questionMarks($question) : 0;
                } else {
                    $answer->is_correct = null;
                    $answer->marks_awarded = null;
                }
            }
        } elseif ($this->isObjectiveQuestion($question)) {
            if ($hasOptionIdPayload) {
                $optionId = isset($validated['option_id']) ? (int) $validated['option_id'] : null;
                if ($optionId !== null && !$this->isValidOptionForQuestion($question, $optionId)) {
                    return response()->json(['message' => 'Selected option is invalid for this question.'], 422);
                }

                $this->applySingleObjectiveSelection($question, $answer, $optionId);
            }

            if ($hasAnswerTextPayload && $questionType === 'true_false') {
                $raw = trim((string) ($validated['answer_text'] ?? ''));
                $normalized = strtolower($raw);
                if (in_array($normalized, ['true', 'false'], true)) {
                    $matching = $this->questionOptions($question)
                        ->first(function ($opt) use ($normalized) {
                            return strtolower(trim((string) ($opt->option_text ?? ''))) === $normalized;
                        });
                    if ($matching) {
                        $this->applySingleObjectiveSelection($question, $answer, (int) $matching->id);
                    } else {
                        $answer->option_id = null;
                        $answer->answer_text = $raw !== '' ? $raw : null;
                        $answer->is_correct = null;
                        $answer->marks_awarded = null;
                    }
                } else {
                    $answer->option_id = null;
                    $answer->answer_text = $raw !== '' ? $raw : null;
                    $answer->is_correct = null;
                    $answer->marks_awarded = null;
                }
            }
        } else {
            if ($hasAnswerTextPayload) {
                $raw = (string) ($validated['answer_text'] ?? '');
                $answer->answer_text = trim($raw) === '' ? null : $raw;
            }
            $answer->option_id = null;
            $answer->is_correct = null;
            $answer->marks_awarded = null;
        }

        if ($hasFlagPayload) {
            $answer->flagged = (bool) ($validated['flagged'] ?? false);
        } elseif (!$answer->exists) {
            $answer->flagged = false;
        }
        $answer->saved_at = $now;
        $answer->save();

        $attempt->update([
            'last_activity_at' => $now,
            'status' => 'in_progress',
        ]);

        /** @var ExamAttemptSession $session */
        $session->update(['last_seen_at' => $now]);

        $responsePayload = [
            'message' => 'Answer saved.',
            'data' => [
                'question_id' => $questionId,
                'saved_at' => $now->toIso8601String(),
                'flagged' => (bool) ($answer->flagged ?? false),
                'option_ids' => $this->extractSelectedOptionIds($answer),
            ],
        ];

        $attempt->increment('sync_version');
        $attempt->update([
            'sync_status' => 'PENDING_SYNC',
        ]);

        return $this->storeIdempotentResponse($request, $attempt->exam_id, $attempt->student_id, $responsePayload, 200);
    }

    public function ping(Request $request, int $attemptId): JsonResponse
    {
        $attempt = ExamAttempt::findOrFail($attemptId);

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->status !== 'in_progress' || !$attempt->started_at || !$attempt->ends_at) {
            return response()->json([
                'status' => 'pending',
                'remaining_seconds' => $this->remainingSecondsForAttempt($attempt),
                'code' => 'attempt_not_started',
            ]);
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
            'remaining_seconds' => $this->remainingSecondsForAttempt($attempt),
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

        if ($attempt->status !== 'in_progress' || !$attempt->started_at || !$attempt->ends_at) {
            return response()->json([
                'message' => 'Attempt has not started yet.',
                'code' => 'attempt_not_started',
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
        $validated = $request->validate([
            'client_submitted_at' => 'nullable|date',
        ]);

        $attempt = ExamAttempt::with('exam')->findOrFail($attemptId);

        $idempotencyReplay = $this->resolveIdempotentReplay($request, $attempt->exam_id, $attempt->student_id);
        if ($idempotencyReplay instanceof JsonResponse) {
            return $idempotencyReplay;
        }

        $session = $this->validateSession($request, $attempt);
        if ($session instanceof JsonResponse) {
            return $session;
        }

        if ($attempt->status !== 'in_progress' || !$attempt->started_at || !$attempt->ends_at) {
            return response()->json([
                'message' => 'Attempt has not started yet.',
                'code' => 'attempt_not_started',
            ], 409);
        }

        if ($attempt->isSubmitted()) {
            $payload = [
                'message' => 'Attempt already submitted.',
                'data' => [
                    'status' => $attempt->status,
                    'score' => $attempt->score,
                ],
            ];

            return $this->storeIdempotentResponse($request, $attempt->exam_id, $attempt->student_id, $payload, 200);
        }

        $result = $this->finalizeAttempt($attempt, 'submitted_by_student', $validated['client_submitted_at'] ?? null);

        ExamAttemptSession::where('attempt_id', $attempt->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'ended_at' => now(),
                'revoked_reason' => 'submitted',
            ]);

        $payload = [
            'message' => 'Attempt submitted successfully.',
            'data' => $result,
        ];

        return $this->storeIdempotentResponse($request, $attempt->exam_id, $attempt->student_id, $payload, 200);
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

    private function buildQuestionOrder(Exam $exam, ?int $studentId = null, ?string $seedNonce = null): array
    {
        $questions = Question::with('bankQuestion:id,difficulty,marks,status')
            ->where('exam_id', $exam->id)
            ->where(function ($query) {
                // Questions linked to bank must remain Active in bank.
                // Standalone/manual exam questions (no bank_question_id) are also allowed.
                $query->whereNull('bank_question_id')
                    ->orWhereHas('bankQuestion', fn ($bq) => $bq->where('status', 'Active'));
            })
            ->orderBy('order_index')
            ->orderBy('id')
            ->get();

        if ($questions->isEmpty()) {
            return [];
        }

        $selectionMode = strtolower((string) ($exam->question_selection_mode ?? 'fixed'));
        $distributionMode = strtolower((string) ($exam->question_distribution ?? ''));
        if (!in_array($distributionMode, ['same_for_all', 'unique_per_student'], true)) {
            // Default to student-unique distribution for CBT security.
            $distributionMode = 'unique_per_student';
        }

        $seedScope = $distributionMode === 'unique_per_student' && $studentId
            ? "exam:{$exam->id}:student:{$studentId}"
            : "exam:{$exam->id}:shared";

        if (is_string($seedNonce) && trim($seedNonce) !== '') {
            $seedScope .= ":{$seedNonce}";
        }

        $selected = $questions->values();

        if ($selectionMode === 'random') {
            $targetCount = (int) ($exam->total_questions_to_serve ?? 0);
            if ($targetCount <= 0 || $targetCount > $questions->count()) {
                $targetCount = $questions->count();
            }

            $selected = collect();
            $remaining = $questions->values();

            $difficultyDistribution = $this->normalizeDifficultyDistribution($exam->difficulty_distribution);
            $marksDistribution = $this->normalizeMarksDistribution($exam->marks_distribution);

            if (!empty($difficultyDistribution)) {
                foreach ($difficultyDistribution as $difficulty => $count) {
                    if ($count <= 0) {
                        continue;
                    }

                    $pool = $remaining
                        ->filter(fn (Question $q) => $this->normalizedQuestionDifficulty($q) === $difficulty)
                        ->values();

                    if ($pool->isEmpty()) {
                        continue;
                    }

                    $picked = $this->stableSortQuestions($pool, "{$seedScope}:difficulty:{$difficulty}")
                        ->take($count)
                        ->values();

                    if ($picked->isNotEmpty()) {
                        $selected = $selected->concat($picked);
                        $pickedIds = $picked->pluck('id')->map(fn ($id) => (int) $id)->all();
                        $remaining = $remaining->reject(fn (Question $q) => in_array((int) $q->id, $pickedIds, true))->values();
                    }
                }
            } elseif (!empty($marksDistribution)) {
                foreach ($marksDistribution as $marks => $count) {
                    if ($count <= 0) {
                        continue;
                    }

                    $pool = $remaining
                        ->filter(fn (Question $q) => (int) round($this->questionMarks($q)) === (int) $marks)
                        ->values();

                    if ($pool->isEmpty()) {
                        continue;
                    }

                    $picked = $this->stableSortQuestions($pool, "{$seedScope}:marks:{$marks}")
                        ->take($count)
                        ->values();

                    if ($picked->isNotEmpty()) {
                        $selected = $selected->concat($picked);
                        $pickedIds = $picked->pluck('id')->map(fn ($id) => (int) $id)->all();
                        $remaining = $remaining->reject(fn (Question $q) => in_array((int) $q->id, $pickedIds, true))->values();
                    }
                }
            }

            if ($selected->count() < $targetCount) {
                $needed = $targetCount - $selected->count();
                $fill = $this->stableSortQuestions($remaining, "{$seedScope}:fill")
                    ->take($needed)
                    ->values();
                $selected = $selected->concat($fill);
                $fillIds = $fill->pluck('id')->map(fn ($id) => (int) $id)->all();
                $remaining = $remaining->reject(fn (Question $q) => in_array((int) $q->id, $fillIds, true))->values();
            }

            if (($exam->question_reuse_policy ?? 'allow_reuse') === 'no_reuse_until_exhausted' && $studentId) {
                $usedByOtherStudents = ExamAttempt::where('exam_id', $exam->id)
                    ->where('student_id', '!=', $studentId)
                    ->whereNotNull('question_order')
                    ->get(['question_order'])
                    ->flatMap(function (ExamAttempt $attempt) {
                        return is_array($attempt->question_order) ? $attempt->question_order : [];
                    })
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->unique()
                    ->values();

                if ($usedByOtherStudents->isNotEmpty()) {
                    $unusedSelected = $selected
                        ->reject(fn (Question $q) => $usedByOtherStudents->contains((int) $q->id))
                        ->values();

                    if ($unusedSelected->count() < $targetCount) {
                        $needed = $targetCount - $unusedSelected->count();
                        $fillUnused = $this->stableSortQuestions(
                            $questions->reject(fn (Question $q) => $usedByOtherStudents->contains((int) $q->id))
                                ->reject(fn (Question $q) => $unusedSelected->contains(fn (Question $sq) => (int) $sq->id === (int) $q->id))
                                ->values(),
                            "{$seedScope}:reuse"
                        )->take($needed)->values();

                        $unusedSelected = $unusedSelected->concat($fillUnused)->values();
                    }

                    if ($unusedSelected->count() < $targetCount) {
                        $needed = $targetCount - $unusedSelected->count();
                        $fallbackFill = $this->stableSortQuestions(
                            $questions->reject(fn (Question $q) => $unusedSelected->contains(fn (Question $sq) => (int) $sq->id === (int) $q->id))
                                ->values(),
                            "{$seedScope}:reuse:fallback"
                        )->take($needed)->values();

                        $unusedSelected = $unusedSelected->concat($fallbackFill)->values();
                    }

                    $selected = $unusedSelected->take($targetCount)->values();
                }
            }

            if ($selected->count() > $targetCount) {
                $selected = $selected->take($targetCount)->values();
            }
        }

        if ($this->shouldShuffleQuestionOrder($exam)) {
            $selected = $this->stableSortQuestions($selected, "{$seedScope}:order")->values();
        } else {
            $selected = $selected
                ->sortBy(fn (Question $q) => [($q->order_index ?? PHP_INT_MAX), $q->id])
                ->values();
        }

        return $selected->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    private function computeEndsAt(Exam $exam, Carbon $startedAt): Carbon
    {
        $durationEnd = $startedAt->copy()->addMinutes(max(1, (int) ($exam->duration_minutes ?? 60)));
        $scheduleEnd = $exam->end_datetime ?? $exam->end_time;
        $graceMinutes = max(0, (int) SystemSetting::get('exam_end_grace_minutes', 0));

        if ($scheduleEnd instanceof Carbon) {
            $scheduleWithGrace = $scheduleEnd->copy()->addMinutes($graceMinutes);
            if ($scheduleWithGrace->lt($durationEnd)) {
                return $scheduleWithGrace;
            }
        }

        return $durationEnd;
    }

    private function remainingSecondsForAttempt(ExamAttempt $attempt): int
    {
        if ($attempt->ends_at instanceof Carbon) {
            return max(0, now()->diffInSeconds($attempt->ends_at, false));
        }

        $durationMinutes = (int) ($attempt->exam?->duration_minutes ?? 60);
        return max(60, $durationMinutes * 60);
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

    private function resolveAttemptMode(Exam $exam): string
    {
        $mode = strtolower(trim((string) SystemSetting::get('assessment_display_mode', 'auto')));
        if ($mode === 'ca_test' || $mode === 'exam') {
            return $mode;
        }

        $assessmentType = strtolower(trim((string) ($exam->assessment_type ?? '')));
        return $assessmentType === 'ca test' ? 'ca_test' : 'exam';
    }

    private function applyAttemptModeScope($query, string $mode): void
    {
        if ($mode === 'ca_test') {
            $query->where('assessment_mode', 'ca_test');
            return;
        }

        // Backward compatibility: treat null assessment_mode as exam mode.
        $query->where(function ($q) {
            $q->where('assessment_mode', 'exam')
                ->orWhereNull('assessment_mode');
        });
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

    private function finalizeAttempt(ExamAttempt $attempt, string $eventType, ?string $clientSubmittedAt = null): array
    {
        $questionIds = collect($attempt->question_order ?: []);
        if ($questionIds->isEmpty()) {
            $questionIds = collect($this->buildQuestionOrder($attempt->exam, (int) $attempt->student_id));
        }

        $questions = Question::with(['options', 'bankQuestion.options'])
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

            $marks = $this->questionMarks($question);
            $totalMarks += $marks;

            /** @var ExamAnswer|null $answer */
            $answer = $answers->get((int) $questionId);
            if (!$answer) {
                continue;
            }

            if ($this->isObjectiveQuestion($question)) {
                $isCorrect = false;

                if ($this->isMultiSelectQuestion($question)) {
                    $selectedIds = $this->extractSelectedOptionIds($answer);
                    $correctIds = $this->questionOptions($question)
                        ->where('is_correct', true)
                        ->pluck('id')
                        ->map(fn ($id) => (int) $id)
                        ->values()
                        ->all();
                    sort($selectedIds);
                    sort($correctIds);
                    $isCorrect = count($selectedIds) > 0 && $selectedIds === $correctIds;
                } else {
                    $selectedSingleOptionId = $this->extractSingleSelectedOptionId($answer);
                    if ($selectedSingleOptionId !== null) {
                        $isCorrect = $this->isCorrectOptionForQuestion($question, $selectedSingleOptionId);
                    }
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
            'client_submitted_at' => $clientSubmittedAt ? Carbon::parse($clientSubmittedAt) : $attempt->client_submitted_at,
            'server_submitted_at' => $now,
            'time_anomaly_flag' => $attempt->time_anomaly_flag || $this->isClientTimeAnomalous($clientSubmittedAt, $now),
            'time_anomaly_reason' => $attempt->time_anomaly_reason ?: $this->timeAnomalyReason($clientSubmittedAt, $now, 'submit_clock_skew'),
            'submitted_at' => $now,
            'completed_at' => $status === 'completed' ? $now : $attempt->completed_at,
            'last_activity_at' => $now,
            'duration_seconds' => $attempt->started_at ? $attempt->started_at->diffInSeconds($now) : null,
            'sync_status' => 'SYNCED',
            'sync_version' => max(1, (int) $attempt->sync_version) + 1,
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
        return in_array($this->questionType($question), [
            'multiple_choice',
            'multiple_choice_single',
            'multiple_select',
            'multiple_choice_multiple',
            'true_false',
            'mcq',
        ], true);
    }

    private function questionText(Question $question): string
    {
        $text = trim((string) ($question->question_text ?? ''));
        if ($text !== '') {
            return $text;
        }

        return trim((string) ($question->bankQuestion?->question_text ?? ''));
    }

    private function questionType(Question $question): string
    {
        $bankType = trim((string) ($question->bankQuestion?->question_type ?? ''));
        if ($bankType !== '') {
            return $bankType;
        }

        $type = trim((string) ($question->question_type ?? ''));
        if ($type !== '') {
            return $type;
        }

        return 'mcq';
    }

    private function questionMarks(Question $question): float
    {
        if (($question->marks_override ?? null) !== null) {
            return (float) $question->marks_override;
        }

        if ($question->marks !== null) {
            return (float) $question->marks;
        }

        if (($question->bankQuestion?->marks ?? null) !== null) {
            return (float) $question->bankQuestion->marks;
        }

        return 1.0;
    }

    private function questionOptions(Question $question)
    {
        $options = $question->options
            ->sortBy(fn ($opt) => [$opt->order_index ?? 0, $opt->id])
            ->values();

        if ($options->isNotEmpty()) {
            return $options;
        }

        return $question->bankQuestion?->options
            ? $question->bankQuestion->options
                ->sortBy(fn ($opt) => [$opt->sort_order ?? 0, $opt->id])
                ->values()
            : collect();
    }

    private function questionOptionsForAttempt(ExamAttempt $attempt, Question $question)
    {
        $options = $this->questionOptions($question);
        if (!$attempt->exam || !$this->shouldShuffleOptions($attempt->exam)) {
            return $options;
        }

        $seed = "attempt:{$attempt->id}:question:{$question->id}:options";
        return $options->sortBy(fn ($opt) => sha1($seed . ':' . (int) $opt->id))->values();
    }

    private function shouldShuffleQuestionOrder(Exam $exam): bool
    {
        return (bool) (
            ($exam->shuffle_question_order ?? false)
            || ($exam->randomize_questions ?? false)
            || ($exam->shuffle_questions ?? false)
        );
    }

    private function shouldShuffleOptions(Exam $exam): bool
    {
        return (bool) (
            ($exam->shuffle_option_order ?? false)
            || ($exam->randomize_options ?? false)
        );
    }

    private function normalizeDifficultyDistribution(mixed $distribution): array
    {
        if (!is_array($distribution)) {
            return [];
        }

        $levels = ['easy', 'medium', 'hard'];
        $normalized = [];

        foreach ($levels as $level) {
            $raw = $distribution[$level] ?? $distribution[ucfirst($level)] ?? null;
            $count = is_numeric($raw) ? max(0, (int) $raw) : 0;
            if ($count > 0) {
                $normalized[$level] = $count;
            }
        }

        return $normalized;
    }

    private function normalizeMarksDistribution(mixed $distribution): array
    {
        if (!is_array($distribution)) {
            return [];
        }

        $normalized = [];
        $isList = array_values(array_keys($distribution)) === array_keys($distribution);

        if ($isList) {
            foreach ($distribution as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $marks = isset($item['marks']) && is_numeric($item['marks']) ? (int) $item['marks'] : 0;
                $count = isset($item['count']) && is_numeric($item['count']) ? max(0, (int) $item['count']) : 0;
                if ($marks > 0 && $count > 0) {
                    $normalized[$marks] = ($normalized[$marks] ?? 0) + $count;
                }
            }
        } else {
            foreach ($distribution as $marks => $count) {
                $m = is_numeric($marks) ? (int) $marks : 0;
                $c = is_numeric($count) ? max(0, (int) $count) : 0;
                if ($m > 0 && $c > 0) {
                    $normalized[$m] = ($normalized[$m] ?? 0) + $c;
                }
            }
        }

        ksort($normalized);
        return $normalized;
    }

    private function normalizedQuestionDifficulty(Question $question): ?string
    {
        $raw = $question->bankQuestion?->difficulty
            ?? $question->difficulty_level
            ?? null;

        if ($raw === null) {
            return null;
        }

        $normalized = strtolower(trim((string) $raw));
        if (in_array($normalized, ['easy', 'medium', 'hard'], true)) {
            return $normalized;
        }

        return null;
    }

    private function stableSortQuestions(Collection $questions, string $seed): Collection
    {
        return $questions
            ->sortBy(fn (Question $q) => sha1($seed . ':' . (int) $q->id))
            ->values();
    }

    private function isValidOptionForQuestion(Question $question, int $optionId): bool
    {
        return $this->questionOptions($question)->contains(fn ($opt) => (int) $opt->id === $optionId);
    }

    private function isQuestionOptionRecord(Question $question, int $optionId): bool
    {
        return $question->options()->where('id', $optionId)->exists();
    }

    private function applySingleObjectiveSelection(Question $question, ExamAnswer $answer, ?int $optionId): void
    {
        if ($optionId === null) {
            $answer->option_id = null;
            $answer->answer_text = null;
            $answer->is_correct = null;
            $answer->marks_awarded = null;
            return;
        }

        // option_id column references question_options only; bank option ids are stored in answer_text JSON.
        $answer->option_id = $this->isQuestionOptionRecord($question, $optionId) ? $optionId : null;
        $answer->answer_text = json_encode([
            'selected_option_id' => $optionId,
            'option_ids' => [$optionId],
        ], JSON_UNESCAPED_UNICODE);

        $isCorrect = $this->isCorrectOptionForQuestion($question, $optionId);
        $answer->is_correct = $isCorrect;
        $answer->marks_awarded = $isCorrect ? $this->questionMarks($question) : 0;
    }

    private function areValidOptionsForQuestion(Question $question, array $optionIds): bool
    {
        if (empty($optionIds)) {
            return true;
        }

        $available = $this->questionOptions($question)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $availableLookup = array_flip($available);
        foreach ($optionIds as $id) {
            if (!isset($availableLookup[(int) $id])) {
                return false;
            }
        }
        return true;
    }

    private function isCorrectOptionForQuestion(Question $question, int $optionId): bool
    {
        return (bool) ($this->questionOptions($question)
            ->first(fn ($opt) => (int) $opt->id === $optionId)?->is_correct ?? false);
    }

    private function normalizeQuestionType(Question $question): string
    {
        return strtolower(trim((string) $this->questionType($question)));
    }

    private function isMultiSelectQuestion(Question $question): bool
    {
        return in_array($this->normalizeQuestionType($question), [
            'multiple_select',
            'multiple_choice_multiple',
        ], true);
    }

    private function normalizeOptionIds(array $optionIds): array
    {
        $normalized = collect($optionIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
        sort($normalized);
        return $normalized;
    }

    private function extractSelectedOptionIds(ExamAnswer $answer): array
    {
        $selected = [];

        if ($answer->option_id) {
            $selected[] = (int) $answer->option_id;
        }

        $text = trim((string) ($answer->answer_text ?? ''));
        if ($text === '') {
            return $this->normalizeOptionIds($selected);
        }

        $decoded = json_decode($text, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $raw = $decoded['option_ids'] ?? $decoded['selected_option_ids'] ?? null;
            if (is_array($raw)) {
                $selected = array_merge($selected, $raw);
            }
        }

        return $this->normalizeOptionIds($selected);
    }

    private function extractSingleSelectedOptionId(ExamAnswer $answer): ?int
    {
        if ($answer->option_id) {
            return (int) $answer->option_id;
        }

        $selected = $this->extractSelectedOptionIds($answer);
        if (empty($selected)) {
            return null;
        }

        return (int) $selected[0];
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

    private function resolveIdempotentReplay(Request $request, ?int $examId = null, ?int $studentId = null): ?JsonResponse
    {
        $key = trim((string) $request->header('Idempotency-Key', ''));
        if ($key === '') {
            return null;
        }

        $requestHash = hash('sha256', json_encode($request->all(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $existing = IdempotencyKey::where('idempotency_key', $key)->first();
        if (!$existing) {
            return null;
        }

        if ($existing->request_hash !== $requestHash) {
            return response()->json([
                'message' => 'Idempotency key reuse with a different payload is not allowed.',
                'code' => 'idempotency_payload_mismatch',
            ], 409);
        }

        $body = $existing->response_json ? json_decode((string) $existing->response_json, true) : [];
        return response()->json($body, (int) $existing->response_status);
    }

    private function storeIdempotentResponse(Request $request, ?int $examId, ?int $studentId, array $payload, int $status = 200): JsonResponse
    {
        $key = trim((string) $request->header('Idempotency-Key', ''));
        if ($key !== '') {
            IdempotencyKey::updateOrCreate(
                ['idempotency_key' => $key],
                [
                    'exam_id' => $examId,
                    'student_id' => $studentId,
                    'request_hash' => hash('sha256', json_encode($request->all(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
                    'response_status' => $status,
                    'response_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]
            );
        }

        return response()->json($payload, $status);
    }

    private function isClientTimeAnomalous(?string $clientTime, Carbon $serverTime): bool
    {
        if (!$clientTime) {
            return false;
        }

        try {
            $client = Carbon::parse($clientTime);
            return abs($client->diffInSeconds($serverTime, false)) > 120;
        } catch (\Throwable $e) {
            return true;
        }
    }

    private function timeAnomalyReason(?string $clientTime, Carbon $serverTime, string $defaultReason): ?string
    {
        if (!$this->isClientTimeAnomalous($clientTime, $serverTime)) {
            return null;
        }

        return $defaultReason;
    }

    private function assessmentDisplayMode(): string
    {
        $mode = strtolower(trim((string) SystemSetting::get('assessment_display_mode', 'auto')));
        return in_array($mode, ['exam', 'ca_test', 'auto'], true) ? $mode : 'auto';
    }

    private function assessmentDisplayLabels(?string $mode = null): array
    {
        $resolvedMode = $mode && in_array($mode, ['exam', 'ca_test', 'auto'], true)
            ? $mode
            : $this->assessmentDisplayMode();

        if ($resolvedMode === 'ca_test') {
            return [
                'assessment_noun' => 'CA Test',
                'assessment_noun_plural' => 'CA Tests',
                'access_code_label' => 'CA Test Access Code',
                'access_code_generator_title' => 'CA Test Access Code Generator',
                'student_portal_subtitle' => 'Student CA Test Portal',
            ];
        }

        if ($resolvedMode === 'auto') {
            return [
                'assessment_noun' => 'Assessment',
                'assessment_noun_plural' => 'Assessments',
                'access_code_label' => 'Assessment Access Code',
                'access_code_generator_title' => 'Assessment Access Code Generator',
                'student_portal_subtitle' => 'Student Assessment Portal',
            ];
        }

        return [
            'assessment_noun' => 'Exam',
            'assessment_noun_plural' => 'Exams',
            'access_code_label' => 'Exam Access Code',
            'access_code_generator_title' => 'Exam Access Code Generator',
            'student_portal_subtitle' => 'Student Exam Portal',
        ];
    }
}
