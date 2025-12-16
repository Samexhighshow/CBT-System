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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

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
            'subjects.*.subject_id' => 'required|integer|exists:cbt_subjects,id',
            'subjects.*.class_category' => 'required|string|in:JSS,SSS,Both',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = $request->user();
            
            // Delete existing teacher subjects
            TeacherSubject::where('teacher_id', $user->id)->delete();

            // Insert new selections
            $teacherSubjects = [];
            foreach ($request->subjects as $subjectData) {
                $teacherSubjects[] = [
                    'teacher_id' => $user->id,
                    'cbt_subject_id' => $subjectData['subject_id'],
                    'class_category' => $subjectData['class_category'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            TeacherSubject::insert($teacherSubjects);

            return response()->json([
                'message' => 'Teacher subjects updated successfully',
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

            return response()->json([
                'teacher_subjects' => $teacherSubjects,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch teacher subjects',
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
