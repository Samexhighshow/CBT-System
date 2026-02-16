<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\Student;
use App\Models\SystemSetting;
use App\Models\Subject;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ExamController extends Controller
{
    /**
     * Return questions for a given exam
     */
    public function getQuestions($id)
    {
        $exam = Exam::with(['questions.options'])->findOrFail($id);
        $questionsQuery = $exam->questions()->with('options');
        // Use a safe default order since some databases may not have order_index
        $questions = $questionsQuery->orderBy('id')->get();

        return response()->json([
            'exam_id' => $exam->id,
            'title' => $exam->title,
            'questions' => $questions,
        ]);
    }
    /**
     * Display a listing of exams with filters
     */
    public function index(Request $request)
    {
        $query = Exam::with(['subject', 'schoolClass']);

        // Filter by class
        if ($request->has('class_id')) {
            $query->forClass($request->class_id);
        }

        // Filter by subject
        if ($request->has('subject_id')) {
            $query->forSubject($request->subject_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by published
        if ($request->has('published')) {
            $published = filter_var($request->published, FILTER_VALIDATE_BOOLEAN);
            $query->where('published', $published);
        }

        // Only show active exams for students
        if ($request->has('active_only')) {
            $query->active();
        }

        $exams = $query->orderBy('created_at', 'desc')->paginate(15);

        // Attach live question_count metadata from exam_questions
        $ids = $exams->getCollection()->pluck('id')->all();
        if (!empty($ids)) {
            $counts = DB::table('exam_questions')
                ->select('exam_id', DB::raw('COUNT(*) as cnt'))
                ->whereIn('exam_id', $ids)
                ->groupBy('exam_id')
                ->pluck('cnt', 'exam_id');

            $exams->getCollection()->transform(function ($exam) use ($counts) {
                $exam->metadata = array_merge((array)($exam->metadata ?? []), [
                    'question_count' => (int) ($counts[$exam->id] ?? 0)
                ]);
                return $exam;
            });
        }

        return response()->json($exams);
    }

    /**
     * Store a newly created exam
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'class_id' => 'required|exists:school_classes,id',
            'class_level_id' => 'nullable|exists:school_classes,id',
            'subject_id' => 'required|exists:subjects,id',
            'duration_minutes' => 'required|integer|min:1|max:300',
            // Assessment structure fields
            'assessment_type' => ['required', Rule::in(['CA Test', 'Midterm Test', 'Final Exam', 'Quiz'])],
            'assessment_weight' => 'nullable|integer|min:1|max:100',
            'academic_session' => 'nullable|string|max:32',
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'allowed_attempts' => 'nullable|integer|min:1|max:10',
            'randomize_questions' => 'nullable|boolean',
            'randomize_options' => 'nullable|boolean',
            'navigation_mode' => ['nullable', Rule::in(['free', 'linear'])],
            'start_datetime' => 'nullable|date|after_or_equal:now',
            'end_datetime' => 'nullable|date|after:start_datetime',
            'start_time' => 'nullable|date',
            'end_time' => 'nullable|date|after:start_time',
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'active', 'completed', 'cancelled'])],
            'published' => 'nullable|boolean',
            'shuffle_questions' => 'nullable|boolean',
            'seat_numbering' => ['nullable', Rule::in(['row_major', 'column_major'])],
            'enforce_adjacency_rules' => 'nullable|boolean',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Resolve class using academic-management style field
        $classId = $request->input('class_level_id', $request->class_id);

        // PHASE 1 VALIDATION: Check if class exists
        $class = SchoolClass::find($classId);
        if (!$class) {
            return response()->json([
                'message' => 'The selected class does not exist',
                'errors' => ['class_id' => ['Class not found']]
            ], 422);
        }

        // PHASE 1 VALIDATION: Check if subject exists
        $subject = Subject::find($request->subject_id);
        if (!$subject) {
            return response()->json([
                'message' => 'The selected subject does not exist',
                'errors' => ['subject_id' => ['Subject not found']]
            ], 422);
        }

        // PHASE 1 VALIDATION: Check if subject is available for the selected class
        // Support both legacy class_id linkage and Academic class_level linkage
        $subjectAssignedToClass = false;
        if (!is_null($subject->class_id)) {
            $subjectAssignedToClass = ($subject->class_id === $class->id);
        } else {
            // Fallback to class_level string match when subjects are stored per class_level
            $subjectAssignedToClass = ($subject->class_level === $class->name);
        }

        if (!$subjectAssignedToClass) {
            return response()->json([
                'message' => 'The selected subject is not assigned to this class',
                'errors' => ['subject_id' => [
                    "Subject '{$subject->name}' is not available for class '{$class->name}'.",
                ]]
            ], 422);
        }

        // Enforce publish-time requirements
        $isPublishing = ($request->boolean('published')) || in_array($request->input('status'), ['scheduled', 'active', 'completed']);
        $start = $request->input('start_datetime') ?? $request->input('start_time');
        $end = $request->input('end_datetime') ?? $request->input('end_time');

        if ($isPublishing) {
            if (!$start || !$end) {
                return response()->json([
                    'message' => 'Start and end time are required to publish an exam',
                    'errors' => ['start_datetime' => ['Start time required when publishing'], 'end_datetime' => ['End time required when publishing']]
                ], 422);
            }

            if (Carbon::parse($start)->gte(Carbon::parse($end))) {
                return response()->json([
                    'message' => 'The end time must be after the start time',
                    'errors' => ['end_datetime' => ['End time must be after start time']]
                ], 422);
            }
        }

        // Create the exam (rules and scope only, no questions/answers)
        $examData = $request->only([
            'title', 'description', 'duration_minutes',
            'assessment_type', 'assessment_weight', 'academic_session', 'term',
            'allowed_attempts', 'randomize_questions', 'randomize_options', 'navigation_mode',
            'start_datetime', 'end_datetime', 'start_time', 'end_time',
            'status', 'published', 'shuffle_questions', 'seat_numbering', 'enforce_adjacency_rules', 'metadata'
        ]);

        // Normalize class identifiers
        $examData['class_id'] = $classId;
        $examData['class_level_id'] = $classId;
        $examData['subject_id'] = $subject->id;

        // Set default values
        $examData['status'] = $examData['status'] ?? 'draft';
        $examData['published'] = $examData['published'] ?? false;
        $examData['allowed_attempts'] = $examData['allowed_attempts'] ?? 1;
        $examData['randomize_questions'] = $examData['randomize_questions'] ?? true;
        $examData['randomize_options'] = $examData['randomize_options'] ?? true;
        $examData['navigation_mode'] = $examData['navigation_mode'] ?? 'free';
        $examData['class_level'] = $class->name; // For backward compatibility
        $examData['department'] = $class->department_id ? $class->department->name : null;
        $examData['academic_session'] = $examData['academic_session'] ?? (string) SystemSetting::get('current_academic_session', $this->defaultAcademicSession());
        $examData['term'] = $this->normalizeTerm($examData['term'] ?? SystemSetting::get('current_term', 'First Term'));

        $exam = Exam::create($examData);

        return response()->json([
            'message' => 'Exam created successfully',
            'id' => $exam->id,
            'title' => $exam->title,
            'subject_id' => $exam->subject_id,
            'class_id' => $exam->class_id,
            'exam' => $exam->load(['subject', 'schoolClass'])
        ], 201);
    }

    /**
     * Display the specified exam
     */
    public function show($id)
    {
        $exam = Exam::with(['subject', 'schoolClass'])->find($id);

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        // Attach live question_count metadata
        $count = DB::table('exam_questions')->where('exam_id', $exam->id)->count();
        $exam->metadata = array_merge((array)($exam->metadata ?? []), [
            'question_count' => (int) $count
        ]);

        return response()->json($exam);
    }

    /**
     * Update the specified exam
     */
    public function update(Request $request, $id)
    {
        $exam = Exam::find($id);

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        // PHASE 8: Allow editing of all exams, including closed/completed
        // Admin has full control to make corrections even after exam completion

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'class_id' => 'sometimes|required|exists:school_classes,id',
            'class_level_id' => 'nullable|exists:school_classes,id',
            'subject_id' => 'sometimes|required|exists:subjects,id',
            'duration_minutes' => 'sometimes|required|integer|min:1|max:300',
            // Assessment structure fields
            'assessment_type' => ['sometimes', 'required', Rule::in(['CA Test', 'Midterm Test', 'Final Exam', 'Quiz'])],
            'assessment_weight' => 'nullable|integer|min:1|max:100',
            'academic_session' => 'nullable|string|max:32',
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'allowed_attempts' => 'nullable|integer|min:1|max:10',
            'randomize_questions' => 'nullable|boolean',
            'randomize_options' => 'nullable|boolean',
            'navigation_mode' => ['nullable', Rule::in(['free', 'linear'])],
            'start_datetime' => 'nullable|date',
            'end_datetime' => 'nullable|date|after:start_datetime',
            'start_time' => 'nullable|date',
            'end_time' => 'nullable|date|after:start_time',
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'active', 'completed', 'cancelled'])],
            'published' => 'nullable|boolean',
            'shuffle_questions' => 'nullable|boolean',
            'seat_numbering' => ['nullable', Rule::in(['row_major', 'column_major'])],
            'enforce_adjacency_rules' => 'nullable|boolean',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Always validate academic linkage
        $classId = $request->input('class_level_id', $request->class_id ?? $exam->class_id);
        $subjectId = $request->subject_id ?? $exam->subject_id;

        // PHASE 3 VALIDATION: Check if class exists
        $class = SchoolClass::find($classId);
        if (!$class) {
            return response()->json([
                'message' => 'The selected class does not exist',
                'errors' => ['class_id' => ['Class not found']]
            ], 422);
        }

        // PHASE 3 VALIDATION: Check if subject exists
        $subject = Subject::find($subjectId);
        if (!$subject) {
            return response()->json([
                'message' => 'The selected subject does not exist',
                'errors' => ['subject_id' => ['Subject not found']]
            ], 422);
        }

        // PHASE 3 VALIDATION: Check if subject is available for the selected class
        // Support both legacy class_id linkage and Academic class_level linkage
        $subjectAssignedToClass = false;
        if (!is_null($subject->class_id)) {
            $subjectAssignedToClass = ($subject->class_id === $class->id);
        } else {
            // Fallback to class_level string match when subjects are stored per class_level
            $subjectAssignedToClass = ($subject->class_level === $class->name);
        }

        if (!$subjectAssignedToClass) {
            return response()->json([
                'message' => 'The selected subject is not assigned to this class',
                'errors' => ['subject_id' => [
                    "Subject '{$subject->name}' is not available for class '{$class->name}'.",
                ]]
            ], 422);
        }

        // Keep academic linkage consistent
        $exam->class_level = $class->name;
        $exam->class_id = $class->id;
        $exam->class_level_id = $class->id;
        $exam->subject_id = $subject->id;
        $exam->department = $class->department_id ? $class->department->name : null;

        // Lifecycle rules
        $currentStatus = $exam->status;
        $newStatus = $request->input('status', $currentStatus);
        $newPublished = $request->has('published') ? $request->boolean('published') : $exam->published;

        // Allow reverting to draft when unpublishing (published=false)
        // But prevent reverting to draft if only changing status without unpublishing
        $isUnpublishing = !$newPublished && $exam->published;
        if ($currentStatus !== 'draft' && $newStatus === 'draft' && !$isUnpublishing) {
            return response()->json([
                'message' => 'Cannot revert a non-draft exam back to draft',
                'errors' => ['status' => ['Invalid lifecycle transition']]
            ], 422);
        }

        // Closed exams cannot be edited to another state
        if (in_array($currentStatus, ['completed']) && $newStatus !== $currentStatus) {
            return response()->json([
                'message' => 'Closed exams cannot be edited',
                'errors' => ['status' => ['Exam is closed']]
            ], 422);
        }

        // Only allow closing from a published/active state
        if ($newStatus === 'completed' && !in_array($currentStatus, ['active', 'scheduled', 'completed'])) {
            return response()->json([
                'message' => 'Exam can only be closed after it is published/active',
                'errors' => ['status' => ['Invalid lifecycle transition']]
            ], 422);
        }

        // PHASE 8: Allow unpublishing without status change
        // Admin should be able to unpublish exam at any time (hide from students)
        $isPublishing = $newPublished || in_array($newStatus, ['scheduled', 'active', 'completed']);
        $start = $request->input('start_datetime', $exam->start_datetime ?? $exam->start_time);
        $end = $request->input('end_datetime', $exam->end_datetime ?? $exam->end_time);

        // Only enforce time requirements when publishing (not when unpublishing)
        if ($isPublishing) {
            if (!$start || !$end) {
                return response()->json([
                    'message' => 'Start and end time are required to publish an exam',
                    'errors' => ['start_datetime' => ['Start time required when publishing'], 'end_datetime' => ['End time required when publishing']]
                ], 422);
            }

            if (Carbon::parse($start)->gte(Carbon::parse($end))) {
                return response()->json([
                    'message' => 'The end time must be after the start time',
                    'errors' => ['end_datetime' => ['End time must be after start time']]
                ], 422);
            }
        }

        // Update exam fields
        $exam->fill($request->only([
            'title', 'description', 'class_id', 'class_level_id', 'subject_id', 'duration_minutes',
            'assessment_type', 'assessment_weight', 'academic_session', 'term',
            'allowed_attempts', 'randomize_questions', 'randomize_options', 'navigation_mode',
            'start_datetime', 'end_datetime', 'start_time', 'end_time', 'status', 'published', 'results_released',
            'shuffle_questions', 'seat_numbering', 'enforce_adjacency_rules', 'metadata'
        ]));

        if ($request->exists('term')) {
            $exam->term = $this->normalizeTerm($request->input('term'));
        } elseif (!$exam->term) {
            $exam->term = $this->normalizeTerm(SystemSetting::get('current_term', 'First Term'));
        }

        if (!$exam->academic_session) {
            $exam->academic_session = (string) SystemSetting::get('current_academic_session', $this->defaultAcademicSession());
        }

        // Ensure lifecycle flags are persisted
        $exam->status = $newStatus;
        $exam->published = $newPublished;

        $exam->save();

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam->load(['subject', 'schoolClass'])
        ]);
    }

    /**
     * Remove the specified exam with confirmation
     * PHASE 8: Require typing exam title for safety
     */
    public function destroy(Request $request, $id)
    {
        $exam = Exam::find($id);

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        // PHASE 8: Verify deletion by requiring exact title match
        $validator = Validator::make($request->all(), [
            'confirmation_title' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Confirmation required',
                'errors' => $validator->errors()
            ], 422);
        }

        // Allow bulk delete bypass with special keyword
        $isBulkDelete = $request->confirmation_title === 'bulk_delete_bypass';
        
        if (!$isBulkDelete && $request->confirmation_title !== $exam->title) {
            return response()->json([
                'message' => 'Exam title does not match',
                'errors' => ['confirmation_title' => ['The exam title you entered does not match. Please type exactly: ' . $exam->title]]
            ], 422);
        }

        // Check for questions (additional safety)
        $questionCount = $exam->questions()->count();
        if ($questionCount > 0) {
            return response()->json([
                'message' => 'Cannot delete exam with questions',
                'errors' => ['questions' => ["This exam has {$questionCount} questions. Please delete all questions first."]]
            ], 422);
        }

        $exam->delete();

        return response()->json([
            'message' => 'Exam deleted successfully',
            'deleted_exam' => [
                'id' => $exam->id,
                'title' => $exam->title
            ]
        ]);
    }

    /**
     * PHASE 7: Check if a student can access an exam
     * Comprehensive eligibility validation without storing answers or calculating scores
     */
    public function checkAccess(Request $request, $id)
    {
        $exam = Exam::with(['subject', 'schoolClass'])->find($id);

        if (!$exam) {
            return response()->json([
                'message' => 'Exam not found',
                'eligible' => false
            ], 404);
        }

        // Get authenticated student or from request
        $student = $request->user() && $request->user() instanceof \App\Models\Student 
            ? $request->user() 
            : \App\Models\Student::find($request->input('student_id'));

        if (!$student) {
            return response()->json([
                'eligible' => false,
                'reason' => 'student_not_found',
                'message' => 'Student authentication required'
            ], 401);
        }

        // Run comprehensive eligibility check (PHASE 7)
        $eligibilityResult = $exam->checkEligibility($student);

        // Return detailed eligibility information
        return response()->json([
            'eligible' => $eligibilityResult['eligible'],
            'reason' => $eligibilityResult['reason'],
            'message' => $eligibilityResult['message'],
            'details' => $eligibilityResult['details'],
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'description' => $exam->description,
                'status' => $exam->status,
                'published' => $exam->published,
                'duration_minutes' => $exam->duration_minutes,
                'start_datetime' => $exam->start_datetime ? $exam->start_datetime->toDateTimeString() : ($exam->start_time ? $exam->start_time->toDateTimeString() : null),
                'end_datetime' => $exam->end_datetime ? $exam->end_datetime->toDateTimeString() : ($exam->end_time ? $exam->end_time->toDateTimeString() : null),
                'class' => $exam->schoolClass ? [
                    'id' => $exam->schoolClass->id,
                    'name' => $exam->schoolClass->name
                ] : null,
                'subject' => $exam->subject ? [
                    'id' => $exam->subject->id,
                    'name' => $exam->subject->name
                ] : null,
                'allowed_attempts' => $exam->allowed_attempts ?? 1,
            ],
            'student' => [
                'id' => $student->id,
                'name' => $student->first_name . ' ' . $student->last_name,
                'class' => $student->schoolClass ? [
                    'id' => $student->schoolClass->id,
                    'name' => $student->schoolClass->name
                ] : null
            ]
        ]);
    }

    /**
     * Start an exam attempt for a student.
     */
    public function startExam(Request $request, $id)
    {
        $exam = Exam::with(['questions'])->findOrFail($id);

        $student = $this->resolveStudentFromRequest($request);
        if (!$student) {
            return response()->json(['message' => 'Student authentication required.'], 401);
        }

        $eligibility = $exam->checkEligibility($student);
        if (!($eligibility['eligible'] ?? false)) {
            return response()->json([
                'message' => $eligibility['message'] ?? 'Exam access denied.',
                'reason' => $eligibility['reason'] ?? 'not_eligible',
                'details' => $eligibility['details'] ?? null,
            ], 403);
        }

        $existingAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('student_id', $student->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->latest('id')
            ->first();

        if ($existingAttempt) {
            return response()->json([
                'message' => 'Existing attempt resumed.',
                'attempt' => $existingAttempt,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'duration_minutes' => $exam->duration_minutes,
                ],
            ]);
        }

        $maxAttempts = (int) ($exam->allowed_attempts ?? 0);
        if ($maxAttempts <= 0) {
            $maxAttempts = (int) (SystemSetting::get('max_exam_attempts', 0) ?? 0);
        }

        if ($maxAttempts > 0) {
            $completedAttemptsCount = ExamAttempt::where('exam_id', $exam->id)
                ->where('student_id', $student->id)
                ->whereIn('status', ['completed', 'submitted'])
                ->count();

            if ($completedAttemptsCount >= $maxAttempts) {
                return response()->json([
                    'message' => 'Maximum allowed attempts reached for this exam.',
                ], 403);
            }
        }

        $startAt = now();
        $endsAt = $this->computeAttemptEndsAt($exam, $startAt);

        $attempt = ExamAttempt::create([
            'attempt_uuid' => (string) Str::uuid(),
            'exam_id' => $exam->id,
            'student_id' => $student->id,
            'started_at' => $startAt,
            'ends_at' => $endsAt,
            'status' => 'in_progress',
        ]);

        return response()->json([
            'message' => 'Exam started successfully.',
            'attempt' => $attempt,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'duration_minutes' => $exam->duration_minutes,
            ],
        ], 201);
    }

    /**
     * Submit or autosave exam answers.
     */
    public function submitExam(Request $request, $id)
    {
        $exam = Exam::with(['questions.options'])->findOrFail($id);

        $answers = $this->normalizeAnswers($request->input('answers', []));
        if (empty($answers)) {
            return response()->json([
                'message' => 'No answers supplied.',
            ], 422);
        }

        $attemptId = $request->input('attempt_id');
        $attempt = null;
        if ($attemptId) {
            $attempt = ExamAttempt::findOrFail($attemptId);
        } else {
            $student = $this->resolveStudentFromRequest($request);
            if (!$student) {
                return response()->json(['message' => 'Student authentication required.'], 401);
            }

            $attempt = ExamAttempt::where('exam_id', $exam->id)
                ->where('student_id', $student->id)
                ->whereIn('status', ['pending', 'in_progress'])
                ->latest('id')
                ->first();

            if (!$attempt) {
                $startAt = now();
                $endsAt = $this->computeAttemptEndsAt($exam, $startAt);
                $attempt = ExamAttempt::create([
                    'attempt_uuid' => (string) Str::uuid(),
                    'exam_id' => $exam->id,
                    'student_id' => $student->id,
                    'started_at' => $startAt,
                    'ends_at' => $endsAt,
                    'status' => 'in_progress',
                ]);
            }
        }

        if ($attempt->exam_id !== $exam->id) {
            return response()->json(['message' => 'Invalid attempt for this exam.'], 403);
        }

        $isFinal = $request->boolean('final') || $request->boolean('submit') || $request->boolean('is_final');
        if ($isFinal && in_array($attempt->status, ['submitted', 'completed'], true)) {
            return response()->json(['message' => 'This exam attempt has already been submitted.'], 409);
        }

        $now = now();
        $questions = $exam->questions->keyBy('id');
        $score = 0.0;
        $totalMarks = (float) $exam->questions->sum(fn (Question $question) => (float) ($question->marks ?? 1));
        $pendingManual = 0;

        DB::transaction(function () use ($answers, $attempt, $questions, $isFinal, $now, &$score, &$pendingManual) {
            foreach ($answers as $answer) {
                $questionId = (int) $answer['question_id'];
                $question = $questions->get($questionId);
                if (!$question) {
                    continue;
                }

                $optionId = $answer['option_id'] ?? null;
                $answerText = $answer['answer_text'] ?? null;

                $payload = [
                    'option_id' => $optionId,
                    'answer_text' => $answerText,
                    'saved_at' => $now,
                ];

                if ($isFinal) {
                    if ($this->requiresManualMarking($question)) {
                        $payload['is_correct'] = null;
                        $payload['marks_awarded'] = null;
                        $pendingManual++;
                    } else {
                        $correctOptionIds = $question->options
                            ->where('is_correct', true)
                            ->pluck('id')
                            ->all();

                        $isCorrect = $optionId ? in_array((int) $optionId, $correctOptionIds, true) : false;
                        $marks = (float) ($question->marks ?? 1);
                        $payload['is_correct'] = $isCorrect;
                        $payload['marks_awarded'] = $isCorrect ? $marks : 0.0;
                        $score += $payload['marks_awarded'];
                    }
                }

                ExamAnswer::updateOrCreate(
                    [
                        'attempt_id' => $attempt->id,
                        'question_id' => $questionId,
                    ],
                    $payload
                );
            }

            if (!$isFinal) {
                $attempt->update([
                    'last_activity_at' => $now,
                    'status' => $attempt->status === 'pending' ? 'in_progress' : $attempt->status,
                ]);
                return;
            }

            $status = $pendingManual > 0 ? 'submitted' : 'completed';
            $durationSeconds = $attempt->started_at ? $attempt->started_at->diffInSeconds($now) : null;

            $attempt->update([
                'submitted_at' => $now,
                'completed_at' => $status === 'completed' ? $now : null,
                'ended_at' => $now,
                'duration_seconds' => $durationSeconds,
                'score' => round($score, 2),
                'status' => $status,
            ]);
        });

        if (!$isFinal) {
            return response()->json([
                'message' => 'Answers saved.',
                'attempt_id' => $attempt->id,
            ]);
        }

        $percentage = $totalMarks > 0 ? round(($score / $totalMarks) * 100, 2) : 0.0;

        return response()->json([
            'message' => 'Exam submitted successfully.',
            'attempt_id' => $attempt->id,
            'score' => round($score, 2),
            'total_marks' => $totalMarks,
            'percentage' => $percentage,
            'pending_manual_count' => $pendingManual,
        ]);
    }

    private function resolveStudentFromRequest(Request $request): ?Student
    {
        if ($request->filled('student_id')) {
            return Student::find($request->input('student_id'));
        }

        $user = $request->user();
        if ($user && $user->email) {
            return Student::where('email', $user->email)->first();
        }

        return null;
    }

    private function computeAttemptEndsAt(Exam $exam, Carbon $startAt): ?Carbon
    {
        $duration = (int) ($exam->duration_minutes ?? 0);
        $endByDuration = $duration > 0 ? $startAt->copy()->addMinutes($duration) : null;
        $scheduleEnd = $exam->end_datetime ?? $exam->end_time;

        if ($scheduleEnd && $endByDuration) {
            return $scheduleEnd->lt($endByDuration) ? $scheduleEnd : $endByDuration;
        }

        return $scheduleEnd ?? $endByDuration;
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

    private function normalizeAnswers($raw): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $answers = [];

        $isAssociative = array_keys($raw) !== range(0, count($raw) - 1);
        if ($isAssociative) {
            foreach ($raw as $questionId => $optionId) {
                $answers[] = [
                    'question_id' => (int) $questionId,
                    'option_id' => is_array($optionId) ? (int) ($optionId[0] ?? 0) : (int) $optionId,
                ];
            }
            return $answers;
        }

        foreach ($raw as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $optionId = $entry['option_id'] ?? $entry['selected_option_id'] ?? null;
            if ($optionId === null && isset($entry['selected_option'])) {
                $optionId = $entry['selected_option'];
            }

            $answers[] = [
                'question_id' => (int) ($entry['question_id'] ?? 0),
                'option_id' => is_array($optionId) ? (int) ($optionId[0] ?? 0) : ($optionId !== null ? (int) $optionId : null),
                'answer_text' => $entry['answer_text'] ?? null,
            ];
        }

        return $answers;
    }

        /**
         * PHASE 8: Toggle results visibility
         * Admin control to release or hide exam results
         * Does NOT compute results, only controls visibility
         */
        public function toggleResultsVisibility(Request $request, $id)
        {
            $exam = Exam::find($id);

            if (!$exam) {
                return response()->json(['message' => 'Exam not found'], 404);
            }

            // Validate input
            $validator = Validator::make($request->all(), [
                'results_released' => 'required|boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $newStatus = $request->boolean('results_released');

            // Only allow releasing results for completed exams
            if ($newStatus && !in_array($exam->status, ['completed', 'active'])) {
                return response()->json([
                    'message' => 'Results can only be released for active or completed exams',
                    'errors' => ['status' => ['Exam status: ' . $exam->status]]
                ], 422);
            }

            // Update visibility flag (no result computation)
            $exam->results_released = $newStatus;
            $exam->save();

            $action = $newStatus ? 'released' : 'hidden';

        return response()->json([
            'message' => "Results {$action} successfully",
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'status' => $exam->status,
                    'results_released' => $exam->results_released,
                    'updated_at' => $exam->updated_at->toDateTimeString()
            ]
        ]);
    }

    private function normalizeTerm(mixed $value): string
    {
        $normalized = trim((string) $value);

        return in_array($normalized, ['First Term', 'Second Term', 'Third Term'], true)
            ? $normalized
            : 'First Term';
    }

    private function defaultAcademicSession(): string
    {
        $year = (int) date('Y');
        return $year . '/' . ($year + 1);
    }
}
