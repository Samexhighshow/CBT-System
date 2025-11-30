<?php

namespace App\Http\Controllers;

use App\Models\CbtSubject;
use App\Models\TeacherSubject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CbtSubjectController extends Controller
{
    // List subjects (teacher sees only assigned, admin sees all)
    public function index(Request $request)
    {
        $user = $request->user();
        
        if ($user->hasRole('admin') || $user->hasRole('main-admin')) {
            $subjects = CbtSubject::with('owner')->get();
        } else {
            // Teacher: only their assigned subjects
            $subjectIds = TeacherSubject::where('teacher_id', $user->id)
                ->pluck('cbt_subject_id');
            $subjects = CbtSubject::whereIn('id', $subjectIds)->with('owner')->get();
        }

        return response()->json(['status' => 'ok', 'subjects' => $subjects]);
    }

    // Create subject (admin/teacher)
    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject_name' => 'required|string',
            'class_level' => 'required|string',
            'shuffle_questions' => 'boolean',
            'questions_required' => 'required|integer|min:1',
            'total_marks' => 'required|integer|min:1',
            'duration_minutes' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ]);

        $subject = CbtSubject::create([
            ...$validated,
            'owner_id' => $request->user()->id,
        ]);

        return response()->json(['status' => 'ok', 'subject' => $subject]);
    }

    // Assign teacher to subject/class
    public function assignTeacher(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => 'required|exists:users,id',
            'cbt_subject_id' => 'required|exists:cbt_subjects,id',
            'class_category' => 'required|in:junior,senior',
        ]);

        $assignment = TeacherSubject::updateOrCreate(
            [
                'teacher_id' => $validated['teacher_id'],
                'cbt_subject_id' => $validated['cbt_subject_id'],
                'class_category' => $validated['class_category'],
            ]
        );

        return response()->json(['status' => 'ok', 'assignment' => $assignment]);
    }

    // Get teacher's assigned subjects
    public function teacherSubjects(Request $request, int $teacherId)
    {
        $assignments = TeacherSubject::where('teacher_id', $teacherId)
            ->with('subject')
            ->get();

        return response()->json(['status' => 'ok', 'assignments' => $assignments]);
    }

    // Teacher self-assigns subjects after role assignment
    public function selfAssignSubjects(Request $request)
    {
        $validated = $request->validate([
            'assignments' => 'required|array',
            'assignments.*.cbt_subject_id' => 'required|exists:cbt_subjects,id',
            'assignments.*.class_category' => 'required|in:junior,senior',
        ]);

        $teacherId = $request->user()->id;

        // Remove old assignments
        TeacherSubject::where('teacher_id', $teacherId)->delete();

        // Add new
        foreach ($validated['assignments'] as $assignment) {
            TeacherSubject::create([
                'teacher_id' => $teacherId,
                'cbt_subject_id' => $assignment['cbt_subject_id'],
                'class_category' => $assignment['class_category'],
            ]);
        }

        return response()->json(['status' => 'ok', 'message' => 'Subjects assigned successfully']);
    }
}
