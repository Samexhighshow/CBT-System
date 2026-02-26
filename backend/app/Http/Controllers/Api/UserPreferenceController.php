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
use Illuminate\Support\Facades\Validator;

class UserPreferenceController extends Controller
{
    /**
     * Get all subjects, classes, and departments
     */
    public function getOptions()
    {
        try {
            $subjects = Subject::where('is_active', true)
                ->select('id', 'name', 'code', 'class_level', 'department_id', 'is_compulsory', 'subject_group')
                ->orderBy('name')
                ->get();

            $classes = SchoolClass::where('is_active', true)
                ->select('id', 'name', 'code', 'department_id')
                ->with('department:id,name,code')
                ->orderBy('name')
                ->get();

            $departments = Department::where('is_active', true)
                ->select('id', 'name', 'code', 'description')
                ->orderBy('name')
                ->get();

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
            // Clean only previous pending/rejected requests before resubmission.
            RoleScope::where('user_id', $user->id)
                ->where('role_name', 'teacher')
                ->whereIn('status', ['pending', 'rejected'])
                ->delete();

            foreach ($request->subjects as $subjectData) {
                RoleScope::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'role_name' => 'teacher',
                        'subject_id' => (int) $subjectData['subject_id'],
                        'class_id' => (int) $subjectData['class_id'],
                        'academic_session' => $request->input('academic_session'),
                        'term' => $request->input('term'),
                    ],
                    [
                        'exam_id' => null,
                        'is_active' => false,
                        'status' => 'pending',
                        'requested_by' => $user->id,
                        'approved_by' => null,
                        'approved_at' => null,
                        'rejected_reason' => null,
                    ]
                );
            }

            return response()->json([
                'message' => 'Your subject/class selection has been submitted for approval.',
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
