<?php

namespace App\Http\Controllers;

use App\Models\CbtStudentExam;
use App\Models\TeacherSubject;
use Illuminate\Http\Request;

class CbtResultsController extends Controller
{
    // Subject summary: highest, lowest, average + attempts list
    public function subjectSummary(Request $request, int $subjectId)
    {
        $user = $request->user();
        
        // Check if teacher has access to this subject
        if ($user->hasRole('teacher')) {
            $hasAccess = TeacherSubject::where('teacher_id', $user->id)
                ->where('cbt_subject_id', $subjectId)
                ->exists();
            
            if (!$hasAccess) {
                return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
            }
        }

        $attempts = CbtStudentExam::where('subject_id', $subjectId)
            ->whereNotNull('score')
            ->with('student')
            ->get();

        if ($attempts->isEmpty()) {
            return response()->json([
                'status' => 'ok',
                'summary' => ['highest' => 0, 'lowest' => 0, 'average' => 0],
                'attempts' => []
            ]);
        }

        $highest = $attempts->max('score');
        $lowest = $attempts->min('score');
        $average = $attempts->avg('score');

        $list = $attempts->map(function ($a) {
            return [
                'id' => $a->id,
                'student_id' => $a->student_id,
                'student_name' => $a->student->name ?? 'Unknown',
                'score' => (float)$a->score,
                'total_marks' => (float)$a->total_marks,
                'percentage' => $a->getPercentage(),
            ];
        });

        return response()->json([
            'status' => 'ok',
            'summary' => [
                'highest' => (float)$highest,
                'lowest' => (float)$lowest,
                'average' => (float)$average,
            ],
            'attempts' => $list,
        ]);
    }

    // All results with filters (admin: all subjects, teacher: assigned subjects)
    public function allResults(Request $request)
    {
        $user = $request->user();
        $studentName = $request->query('student_name');
        $classLevel = $request->query('class_level');
        $subjectId = $request->query('subject_id');

        $query = CbtStudentExam::with(['student', 'subject']);

        // Filter by teacher's assigned subjects
        if ($user->hasRole('teacher')) {
            $subjectIds = TeacherSubject::where('teacher_id', $user->id)
                ->pluck('cbt_subject_id');
            $query->whereIn('subject_id', $subjectIds);
        }

        // Apply filters
        if ($studentName) {
            $query->whereHas('student', function($q) use ($studentName) {
                $q->where('name', 'like', "%{$studentName}%");
            });
        }

        if ($classLevel) {
            $query->whereHas('subject', function($q) use ($classLevel) {
                $q->where('class_level', $classLevel);
            });
        }

        if ($subjectId) {
            $query->where('subject_id', $subjectId);
        }

        $results = $query->whereNotNull('score')->get()->map(function($a) {
            return [
                'id' => $a->id,
                'student_name' => $a->student->name ?? 'Unknown',
                'subject' => $a->subject->subject_name ?? 'Unknown',
                'class_level' => $a->subject->class_level ?? '',
                'score' => (float)$a->score,
                'total_marks' => (float)$a->total_marks,
                'percentage' => $a->getPercentage(),
                'status' => $a->status,
            ];
        });

        return response()->json(['status' => 'ok', 'results' => $results]);
    }
}
