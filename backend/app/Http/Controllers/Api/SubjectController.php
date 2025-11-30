<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index()
    {
        // Align with current model: no singular department relation, uses pivot or JSON configuration
        $subjects = Subject::orderBy('name')->get();
        return response()->json($subjects);
    }

    public function show($id)
    {
        $subject = Subject::findOrFail($id);
        return response()->json($subject);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:subjects,name',
            'code' => 'required|string|max:20|unique:subjects,code',
            'description' => 'nullable|string',
            'department_id' => 'required|exists:departments,id',
        ]);

        $subject = Subject::create($validated);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject->load('department')
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
