<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Models\SchoolClass;
use App\Models\Department;
use App\Models\User;
use App\Models\Student;
use App\Models\TeacherSubject;
use App\Models\CbtSubject;
use App\Models\RoleScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UserPreferenceController extends Controller
{
    /**
     * Get all subjects, classes, and departments
     */
    public function getOptions()
    {
        try {
            $pickColumns = static function (string $table, array $columns): array {
                return collect($columns)
                    ->filter(fn (string $column) => Schema::hasColumn($table, $column))
                    ->values()
                    ->all();
            };

            $subjectColumns = $pickColumns('subjects', [
                'id',
                'name',
                'code',
                'class_level',
                'class_id',
                'department_id',
                'is_compulsory',
                'subject_group',
                'subject_type',
            ]);
            if (!in_array('id', $subjectColumns, true) || !in_array('name', $subjectColumns, true)) {
                $subjectColumns = ['id', 'name'];
            }

            $classColumns = $pickColumns('school_classes', ['id', 'name', 'code', 'department_id']);
            if (!in_array('id', $classColumns, true) || !in_array('name', $classColumns, true)) {
                $classColumns = ['id', 'name'];
            }

            $departmentColumns = $pickColumns('departments', ['id', 'name', 'code', 'description', 'class_level']);
            if (!in_array('id', $departmentColumns, true) || !in_array('name', $departmentColumns, true)) {
                $departmentColumns = ['id', 'name'];
            }

            $subjectsQuery = Subject::query()->select($subjectColumns);
            if (Schema::hasColumn('subjects', 'is_active')) {
                $subjectsQuery->where('is_active', true);
            }
            $subjects = $subjectsQuery->orderBy('name')->get();

            $classesQuery = SchoolClass::query()->select($classColumns);
            if (Schema::hasColumn('school_classes', 'is_active')) {
                $classesQuery->where('is_active', true);
            }
            if (Schema::hasColumn('school_classes', 'department_id')) {
                $classesQuery->with('department:id,name');
            }
            $classes = $classesQuery->orderBy('name')->get();

            $departmentsQuery = Department::query()->select($departmentColumns);
            if (Schema::hasColumn('departments', 'is_active')) {
                $departmentsQuery->where('is_active', true);
            }
            $departments = $departmentsQuery->orderBy('name')->get();

            return response()->json([
                'subjects' => $subjects,
                'classes' => $classes,
                'departments' => $departments,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch options',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Save teacher's subject selections
     */
    public function saveTeacherSubjects(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'subjects' => 'required|array',
            'subjects.*.subject_id' => 'required|integer|exists:subjects,id',
            'subjects.*.class_id' => 'required|integer|exists:school_classes,id',
            'reason' => 'required|string|min:5|max:500',
            'academic_session' => 'nullable|string|max:64',
            'term' => 'nullable|in:First Term,Second Term,Third Term',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = $request->user();
            $hasPendingRequest = RoleScope::where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->where('status', 'pending')
                ->exists();

            if ($hasPendingRequest) {
                return response()->json([
                    'message' => 'You already have a pending scope request. Please wait for review or cancel it before submitting another request.',
                ], 409);
            }

            $batchId = (string) Str::uuid();
            $reason = trim((string) $request->input('reason', ''));

            foreach ($request->subjects as $subjectData) {
                RoleScope::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'role_name' => 'teacher',
                        'request_batch_id' => $batchId,
                        'subject_id' => (int) $subjectData['subject_id'],
                        'class_id' => (int) $subjectData['class_id'],
                        'academic_session' => $request->input('academic_session'),
                        'term' => $request->input('term'),
                    ],
                    [
                        'exam_id' => null,
                        'is_active' => false,
                        'status' => 'pending',
                        'request_reason' => $reason,
                        'requested_by' => $user->id,
                        'approved_by' => null,
                        'approved_at' => null,
                        'rejected_reason' => null,
                    ]
                );
            }

            return response()->json([
                'message' => 'Your subject/class selection has been submitted for approval.',
                'request_batch_id' => $batchId,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to save teacher subjects',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get teacher's current subject selections
     */
    public function getTeacherSubjects(Request $request)
    {
        try {
            $user = $request->user();

            // Return all teacher scopes for onboarding status display.
            $scopes = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->orderByDesc('id')
                ->with(['subject:id,name', 'schoolClass:id,name'])
                ->get();

            $teacherSubjects = $scopes
                ->filter(fn ($scope) => !empty($scope->subject?->name))
                ->map(function ($first) {
                    $subjectName = (string) ($first->subject?->name ?? 'Unknown');
                    $category = 'junior';
                    $className = strtoupper(trim((string) ($first->schoolClass?->name ?? '')));
                    if (str_starts_with($className, 'SSS')) {
                        $category = 'senior';
                    }

                    $cbtSubject = CbtSubject::query()
                        ->whereRaw('LOWER(subject_name) = ?', [strtolower($subjectName)])
                        ->first();

                    return [
                        'id' => $first->id,
                        'subject_id' => (int) ($first->subject_id ?? 0),
                        'subject_name' => $subjectName,
                        'subject_code' => (string) ($cbtSubject?->code ?? ''),
                        'class_id' => (int) ($first->class_id ?? 0),
                        'class_name' => (string) ($first->schoolClass?->name ?? ''),
                        'class_category' => $category,
                        'status' => (string) ($first->status ?? 'pending'),
                        'is_active' => (bool) $first->is_active,
                        'rejected_reason' => (string) ($first->rejected_reason ?? ''),
                    ];
                })
                ->filter(fn ($row) => (int) ($row['subject_id'] ?? 0) > 0 && (int) ($row['class_id'] ?? 0) > 0)
                ->sortByDesc('id')
                ->values();

            // Backward fallback when role scopes are empty but legacy teacher_subjects exist.
            if ($teacherSubjects->isEmpty()) {
                $teacherSubjects = TeacherSubject::where('teacher_id', $user->id)
                    ->with('subject:id,name,code')
                    ->get()
                    ->map(function ($ts) {
                        return [
                            'id' => $ts->id,
                            'subject_id' => $ts->cbt_subject_id,
                            'subject_name' => $ts->subject->name ?? 'Unknown',
                            'subject_code' => $ts->subject->code ?? '',
                            'class_category' => $ts->class_category,
                        ];
                    });
            }

            return response()->json([
                'teacher_subjects' => $teacherSubjects,
                'scope_summary' => [
                    'approved_count' => $scopes->where('status', 'approved')->where('is_active', true)->count(),
                    'pending_count' => $scopes->where('status', 'pending')->count(),
                    'rejected_count' => $scopes->where('status', 'rejected')->count(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch teacher subjects',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getTeacherScopeStatus(Request $request)
    {
        try {
            $user = $request->user();

            $scopes = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->get(['status', 'is_active', 'rejected_reason', 'subject_id', 'class_id', 'created_at']);

            $approved = $scopes->where('status', 'approved')->where('is_active', true)->count();
            $pending = $scopes->where('status', 'pending')->count();
            $rejected = $scopes->where('status', 'rejected')->count();

            return response()->json([
                'has_approved_scope' => $approved > 0,
                'approved_count' => $approved,
                'pending_count' => $pending,
                'rejected_count' => $rejected,
                'latest_rejection_reason' => (string) ($scopes->where('status', 'rejected')->sortByDesc('created_at')->first()?->rejected_reason ?? ''),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to load teacher scope status',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getTeacherAssignment(Request $request)
    {
        try {
            $user = $request->user();

            $approvedScopes = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->where('status', 'approved')
                ->where('is_active', true)
                ->with(['subject:id,name', 'schoolClass:id,name'])
                ->orderBy('subject_id')
                ->orderBy('class_id')
                ->get();

            $pendingScopes = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->where('status', 'pending')
                ->with(['subject:id,name', 'schoolClass:id,name'])
                ->orderByDesc('id')
                ->get();

            $latestRejected = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->where('status', 'rejected')
                ->orderByDesc('updated_at')
                ->first(['rejected_reason', 'updated_at']);

            $pendingBatchId = (string) ($pendingScopes->first()?->request_batch_id ?: '');
            $pendingReason = (string) ($pendingScopes->first()?->request_reason ?: '');

            return response()->json([
                'current_approved_scopes' => $approvedScopes->map(function (RoleScope $scope) {
                    return [
                        'id' => (int) $scope->id,
                        'subject_id' => (int) ($scope->subject_id ?? 0),
                        'subject_name' => (string) ($scope->subject?->name ?? ''),
                        'class_id' => (int) ($scope->class_id ?? 0),
                        'class_name' => (string) ($scope->schoolClass?->name ?? ''),
                    ];
                })->values(),
                'pending_request' => $pendingScopes->isEmpty() ? null : [
                    'batch_id' => $pendingBatchId,
                    'reason' => $pendingReason,
                    'created_at' => (string) $pendingScopes->max('created_at'),
                    'scopes' => $pendingScopes->map(function (RoleScope $scope) {
                        return [
                            'id' => (int) $scope->id,
                            'subject_id' => (int) ($scope->subject_id ?? 0),
                            'subject_name' => (string) ($scope->subject?->name ?? ''),
                            'class_id' => (int) ($scope->class_id ?? 0),
                            'class_name' => (string) ($scope->schoolClass?->name ?? ''),
                        ];
                    })->values(),
                ],
                'latest_rejection' => $latestRejected ? [
                    'reason' => (string) ($latestRejected->rejected_reason ?? ''),
                    'reviewed_at' => (string) ($latestRejected->updated_at ?? ''),
                ] : null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch teacher assignment',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function cancelPendingTeacherRequest(Request $request)
    {
        try {
            $user = $request->user();
            $batchId = trim((string) $request->input('batch_id', ''));

            $query = RoleScope::query()
                ->where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->where('status', 'pending');

            if ($batchId !== '') {
                $query->where('request_batch_id', $batchId);
            }

            $updated = $query->update([
                'status' => 'rejected',
                'is_active' => false,
                'rejected_reason' => 'Cancelled by teacher before review.',
                'approved_by' => null,
                'approved_at' => null,
            ]);

            if ($updated === 0) {
                return response()->json([
                    'message' => 'No pending request found to cancel.',
                ], 404);
            }

            return response()->json([
                'message' => 'Pending request cancelled successfully.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to cancel pending request',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Save student's subject selections
     */
    public function saveStudentSubjects(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'subject_ids' => 'required|array',
            'subject_ids.*' => 'integer|exists:subjects,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = $request->user();
            
            // Find student record
            $student = Student::where('email', $user->email)->first();
            
            if (!$student) {
                return response()->json([
                    'message' => 'Student record not found',
                ], 404);
            }

            // Sync subjects (remove old, add new)
            $student->subjects()->sync($request->subject_ids);

            return response()->json([
                'message' => 'Student subjects updated successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to save student subjects',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get student's current subject selections
     */
    public function getStudentSubjects(Request $request)
    {
        try {
            $user = $request->user();
            
            // Find student record
            $student = Student::where('email', $user->email)
                ->with(['subjects:id,name,code,is_compulsory', 'department:id,name', 'schoolClass:id,name'])
                ->first();
            
            if (!$student) {
                return response()->json([
                    'message' => 'Student record not found',
                    'student_subjects' => [],
                    'department' => null,
                    'class' => null,
                ], 404);
            }

            return response()->json([
                'student_subjects' => $student->subjects,
                'department' => $student->department,
                'class' => $student->schoolClass,
                'class_id' => $student->class_id,
                'department_id' => $student->department_id,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch student subjects',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update student's class and department
     */
    public function updateStudentClassDepartment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'class_id' => 'required|integer|exists:school_classes,id',
            'department_id' => 'nullable|integer|exists:departments,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = $request->user();
            
            // Find student record
            $student = Student::where('email', $user->email)->first();
            
            if (!$student) {
                return response()->json([
                    'message' => 'Student record not found',
                ], 404);
            }

            $student->update([
                'class_id' => $request->class_id,
                'department_id' => $request->department_id,
            ]);

            return response()->json([
                'message' => 'Class and department updated successfully',
                'student' => $student->load(['schoolClass:id,name', 'department:id,name']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update class and department',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get subjects for a specific class
     */
    public function getSubjectsByClass(Request $request, $classId)
    {
        try {
            $class = SchoolClass::with('department')->findOrFail($classId);
            
            $subjects = Subject::where('is_active', true)
                ->where(function ($query) use ($class) {
                    $query->where('class_id', $class->id)
                        ->orWhere(function ($q) use ($class) {
                            $q->whereNull('class_id')
                              ->where('is_compulsory', true);
                        });
                })
                ->select('id', 'name', 'code', 'is_compulsory', 'subject_group', 'class_level')
                ->orderBy('is_compulsory', 'desc')
                ->orderBy('name')
                ->get();

            return response()->json([
                'subjects' => $subjects,
                'class' => $class,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch subjects for class',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
