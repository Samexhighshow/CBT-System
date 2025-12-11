<?php

namespace App\Http\Controllers;

use App\Models\CbtStudentExam;
use App\Models\User;
use App\Models\TeacherSubject;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use App\Mail\StudentResultsMail;

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

    // Aggregated analytics for results page
    public function analytics(Request $request)
    {
        $user = $request->user();
        $subjectId = $request->query('subject_id');
        $classLevel = $request->query('class_level');
        $studentId = $request->query('student_id');

        $query = CbtStudentExam::with('subject')->whereNotNull('score');

        if ($user->hasRole('teacher')) {
            $subjectIds = TeacherSubject::where('teacher_id', $user->id)
                ->pluck('cbt_subject_id');
            $query->whereIn('subject_id', $subjectIds);
        }

        if ($studentId) {
            $query->where('student_id', $studentId);
        }

        if ($classLevel) {
            $query->whereHas('subject', function ($q) use ($classLevel) {
                $q->where('class_level', $classLevel);
            });
        }

        if ($subjectId) {
            $query->where('subject_id', $subjectId);
        }

        $attempts = $query->get();

        $totalSubmissions = $attempts->count();
        $averageScore = $totalSubmissions > 0
            ? round($attempts->avg(fn ($a) => $a->getPercentage() ?? 0), 1)
            : 0;

        $passCount = $attempts->filter(fn ($a) => ($a->getPercentage() ?? 0) >= 50)->count();
        $passRate = $totalSubmissions > 0
            ? round(($passCount / $totalSubmissions) * 100, 1)
            : 0;

        return response()->json([
            'status' => 'ok',
            'average_score' => $averageScore,
            'pass_rate' => $passRate,
            'total_submissions' => $totalSubmissions,
        ]);
    }

    // Per-student report cards with teacher/admin scoping
    public function reportCards(Request $request)
    {
        $user = $request->user();
        $studentName = $request->query('student_name');
        $classLevel = $request->query('class_level');
        $subjectId = $request->query('subject_id');

        $query = CbtStudentExam::with(['student', 'subject'])
            ->whereNotNull('score');

        if ($user->hasRole('teacher')) {
            $subjectIds = TeacherSubject::where('teacher_id', $user->id)
                ->pluck('cbt_subject_id');
            $query->whereIn('subject_id', $subjectIds);
        }

        if ($studentName) {
            $query->whereHas('student', function ($q) use ($studentName) {
                $q->where('name', 'like', "%{$studentName}%");
            });
        }

        if ($classLevel) {
            $query->whereHas('subject', function ($q) use ($classLevel) {
                $q->where('class_level', $classLevel);
            });
        }

        if ($subjectId) {
            $query->where('subject_id', $subjectId);
        }

        $attempts = $query->get();

        $reportCards = $attempts
            ->groupBy('student_id')
            ->map(function (Collection $studentAttempts) {
                /** @var CbtStudentExam $first */
                $first = $studentAttempts->first();
                $student = $first->student;
                $results = $studentAttempts->map(fn ($a) => [
                    'attempt_id' => $a->id,
                    'subject_id' => $a->subject_id,
                    'subject' => $a->subject->subject_name ?? 'Unknown',
                    'class_level' => $a->subject->class_level ?? '',
                    'score' => (float) $a->score,
                    'total_marks' => (float) $a->total_marks,
                    'percentage' => $a->getPercentage(),
                    'grade' => $a->getGrade(),
                    'status' => $a->status,
                    'submitted_at' => optional($a->submitted_at)->toDateTimeString(),
                ]);

                $average = round($results->avg(fn ($r) => $r['percentage'] ?? 0), 1);
                $passCount = $results->filter(fn ($r) => ($r['percentage'] ?? 0) >= 50)->count();
                $totalSubjects = $results->count();
                $passRate = $totalSubjects > 0 ? round(($passCount / $totalSubjects) * 100, 1) : 0;

                return [
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_email' => $student->email,
                    'class_level' => $results->first()['class_level'] ?? '',
                    'average_percentage' => $average,
                    'pass_rate' => $passRate,
                    'total_subjects' => $totalSubjects,
                    'results' => $results,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'ok',
            'report_cards' => $reportCards,
        ]);
    }

    // Email a student's report card to their registered email
    public function emailStudentReport(Request $request, int $studentId)
    {
        $user = $request->user();
        $student = User::where('id', $studentId)->first();

        if (!$student) {
            return response()->json(['status' => 'error', 'message' => 'Student not found'], 404);
        }

        if (!$student->email) {
            return response()->json(['status' => 'error', 'message' => 'Student has no email on file'], 400);
        }

        $query = CbtStudentExam::with(['student', 'subject'])
            ->whereNotNull('score')
            ->where('student_id', $student->id);

        if ($user->hasRole('teacher')) {
            $subjectIds = TeacherSubject::where('teacher_id', $user->id)
                ->pluck('cbt_subject_id');
            $query->whereIn('subject_id', $subjectIds);
        }

        $attempts = $query->get();

        if ($attempts->isEmpty()) {
            return response()->json(['status' => 'error', 'message' => 'No results available for this student'], 404);
        }

        $reportCard = $this->buildReportCardPayload($attempts);

        Mail::to($student->email)->send(new StudentResultsMail($student, $reportCard));

        return response()->json(['status' => 'ok', 'message' => 'Results emailed successfully']);
    }

    private function buildReportCardPayload(Collection $attempts): array
    {
        /** @var CbtStudentExam $first */
        $first = $attempts->first();
        $student = $first->student;
        $results = $attempts->map(fn ($a) => [
            'attempt_id' => $a->id,
            'subject' => $a->subject->subject_name ?? 'Unknown',
            'class_level' => $a->subject->class_level ?? '',
            'score' => (float) $a->score,
            'total_marks' => (float) $a->total_marks,
            'percentage' => $a->getPercentage(),
            'grade' => $a->getGrade(),
            'status' => $a->status,
            'submitted_at' => optional($a->submitted_at)->toDateTimeString(),
        ]);

        $average = round($results->avg(fn ($r) => $r['percentage'] ?? 0), 1);
        $passCount = $results->filter(fn ($r) => ($r['percentage'] ?? 0) >= 50)->count();
        $totalSubjects = $results->count();
        $passRate = $totalSubjects > 0 ? round(($passCount / $totalSubjects) * 100, 1) : 0;

        return [
            'student_id' => $student->id,
            'student_name' => $student->name,
            'student_email' => $student->email,
            'class_level' => $results->first()['class_level'] ?? '',
            'average_percentage' => $average,
            'pass_rate' => $passRate,
            'total_subjects' => $totalSubjects,
            'results' => $results,
        ];
    }
}
