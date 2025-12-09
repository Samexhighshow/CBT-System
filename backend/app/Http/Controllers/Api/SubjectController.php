<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        // Align with current model: no singular department relation, uses pivot or JSON configuration
        $query = Subject::query();

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Department filter
        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Pagination
        $perPage = $request->input('limit', 15);
        $subjects = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'data' => $subjects->items(),
            'current_page' => $subjects->currentPage(),
            'last_page' => $subjects->lastPage(),
            'per_page' => $subjects->perPage(),
            'total' => $subjects->total(),
            'next_page' => $subjects->currentPage() < $subjects->lastPage() ? $subjects->currentPage() + 1 : null,
            'prev_page' => $subjects->currentPage() > 1 ? $subjects->currentPage() - 1 : null,
        ]);
    }

    public function show($id)
    {
        $subject = Subject::findOrFail($id);
        return response()->json($subject);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:20|unique:subjects,code',
            'description' => 'nullable|string',
            'class_id' => 'required|exists:school_classes,id',
            'department_id' => 'nullable|exists:departments,id',
            'subject_type' => 'required|in:core,elective',
            'is_compulsory' => 'boolean',
        ]);

        // Check if class requires department (SSS classes)
        $class = \App\Models\SchoolClass::find($validated['class_id']);
        if ($class && $class->isSSSClass() && !$request->department_id) {
            return response()->json([
                'message' => 'Department is required for SSS classes',
                'errors' => ['department_id' => ['Department is required for SSS classes']]
            ], 422);
        }

        // Check for duplicate subject in same class/department
        $exists = Subject::where('name', $validated['name'])
            ->where('class_id', $validated['class_id'])
            ->where('department_id', $validated['department_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'This subject already exists for this class/department combination',
                'errors' => ['name' => ['Subject already exists for this class/department']]
            ], 422);
        }

        $subject = Subject::create($validated);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject->load(['schoolClass', 'department'])
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $subject = Subject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:subjects,name,' . $id,
            'code' => 'sometimes|string|max:20|unique:subjects,code,' . $id,
            'description' => 'nullable|string',
            'department_id' => 'sometimes|exists:departments,id',
        ]);

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->load('department')
        ]);
    }

    public function destroy($id)
    {
        $subject = Subject::findOrFail($id);
        $subject->delete();

        return response()->json([
            'message' => 'Subject deleted successfully'
        ]);
    }

    /**
     * Get subjects for a student based on class level and department
     */
    public function getSubjectsForStudent(Request $request)
    {
        $validated = $request->validate([
            'class_level' => 'required|in:JSS1,JSS2,JSS3,SSS1,SSS2,SSS3',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $classLevel = $validated['class_level'];
        $departmentId = $validated['department_id'] ?? null;
        $isJSS = str_starts_with($classLevel, 'JSS');

        // Query subjects
        $compulsory = Subject::where('subject_group', 'compulsory')
            ->where(function($q) use ($classLevel) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
            })
            ->get();

        $trade = Subject::where('subject_group', 'trade')
            ->where(function($q) use ($classLevel, $departmentId) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
                if ($departmentId) {
                    $q->where(function($q2) use ($departmentId) {
                        $q2->whereJsonContains('departments', $departmentId)
                           ->orWhereNull('departments');
                    });
                }
            })
            ->get();

        $elective = Subject::where('subject_group', 'elective')
            ->where(function($q) use ($classLevel, $departmentId) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
                if ($departmentId) {
                    $q->where(function($q2) use ($departmentId) {
                        $q2->whereJsonContains('departments', $departmentId)
                           ->orWhereNull('departments');
                    });
                }
            })
            ->get();

        return response()->json([
            'compulsory' => $compulsory,
            'trade' => $trade,
            'elective' => $elective,
        ]);
    }

    /**
     * Save student subject selections
     */
    public function saveStudentSubjects(Request $request)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'subject_ids' => 'required|array',
            'subject_ids.*' => 'exists:subjects,id',
        ]);

        $student = \App\Models\Student::findOrFail($validated['student_id']);
        $student->subjects()->sync($validated['subject_ids']);

        return response()->json([
            'message' => 'Subjects saved successfully',
            'subjects' => $student->subjects
        ]);
    }
}
