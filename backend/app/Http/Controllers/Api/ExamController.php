<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Subject;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class ExamController extends Controller
{
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

        $exam = Exam::create($examData);

        return response()->json([
            'message' => 'Exam created successfully',
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

        // Closed exams cannot be edited
        if (in_array($exam->status, ['completed'])) {
            return response()->json([
                'message' => 'Closed exams cannot be edited',
                'errors' => ['status' => ['Exam is closed']]
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'class_id' => 'sometimes|required|exists:school_classes,id',
            'class_level_id' => 'nullable|exists:school_classes,id',
            'subject_id' => 'sometimes|required|exists:subjects,id',
            'duration_minutes' => 'sometimes|required|integer|min:1|max:300',
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

        // Prevent reverting to draft once moved forward
        if ($currentStatus !== 'draft' && $newStatus === 'draft') {
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

        // Publishing guard: must have valid time window
        $isPublishing = $newPublished || in_array($newStatus, ['scheduled', 'active', 'completed']);
        $start = $request->input('start_datetime', $exam->start_datetime ?? $exam->start_time);
        $end = $request->input('end_datetime', $exam->end_datetime ?? $exam->end_time);

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
            'allowed_attempts', 'randomize_questions', 'randomize_options', 'navigation_mode',
            'start_datetime', 'end_datetime', 'start_time', 'end_time', 'status', 'published', 'results_released',
            'shuffle_questions', 'seat_numbering', 'enforce_adjacency_rules', 'metadata'
        ]));

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
     * Remove the specified exam
     */
    public function destroy($id)
    {
        $exam = Exam::find($id);

        if (!$exam) {
            return response()->json(['message' => 'Exam not found'], 404);
        }

        // Allow deletion of draft or cancelled exams regardless of published status
        if (!in_array($exam->status, ['draft', 'cancelled'])) {
            return response()->json([
                'message' => 'Only draft or cancelled exams can be deleted',
                'errors' => ['status' => ['Cannot delete exam with status: ' . $exam->status . '. Current exams must be closed first.']]
            ], 422);
        }

        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
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
}
