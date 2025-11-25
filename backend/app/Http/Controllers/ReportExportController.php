<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Exam;
use App\Models\Student;
use App\Models\ExamAttempt;
use App\Models\Department;

class ReportExportController extends Controller
{
    public function exportStudentList(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Student::query();

        if ($request->query('department_id')) {
            $query->where('department_id', $request->query('department_id'));
        }

        if ($request->query('class_level')) {
            $query->where('class_level', $request->query('class_level'));
        }

        $students = $query->get();

        $csv = "Student ID,First Name,Last Name,Email,Class Level,Department,Registered At\n";
        foreach ($students as $student) {
            $csv .= sprintf(
                "%s,%s,%s,%s,%s,%s,%s\n",
                $student->student_id,
                $student->first_name,
                $student->last_name,
                $student->email,
                $student->class_level,
                $student->department_id ? Department::find($student->department_id)->name : 'N/A',
                $student->created_at->format('Y-m-d')
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename=student_list.csv');
    }

    public function exportExamList(Request $request)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Exam::query();

        if ($request->query('class_level')) {
            $query->where('class_level', $request->query('class_level'));
        }

        if ($request->query('published') !== null) {
            $query->where('published', filter_var($request->query('published'), FILTER_VALIDATE_BOOLEAN));
        }

        $exams = $query->with('questions')->get();

        $csv = "Exam ID,Title,Class Level,Duration (mins),Questions,Published,Created At\n";
        foreach ($exams as $exam) {
            $csv .= sprintf(
                "%d,%s,%s,%d,%d,%s,%s\n",
                $exam->id,
                $exam->title,
                $exam->class_level,
                $exam->duration_minutes,
                $exam->questions->count(),
                $exam->published ? 'Yes' : 'No',
                $exam->created_at->format('Y-m-d')
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename=exam_list.csv');
    }

    public function exportResultsSummary(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $dateFrom = $request->query('from', now()->subMonth()->toDateString());
        $dateTo = $request->query('to', now()->toDateString());

        $attempts = ExamAttempt::whereBetween('synced_at', [$dateFrom, $dateTo])
            ->with('exam', 'student')
            ->get();

        $csv = "Exam Title,Student ID,Student Name,Score,Duration (minutes),Status,Submitted At\n";
        foreach ($attempts as $attempt) {
            $csv .= sprintf(
                "%s,%s,%s,%s,%.2f,%s,%s\n",
                $attempt->exam->title,
                $attempt->student->student_id,
                $attempt->student->first_name . ' ' . $attempt->student->last_name,
                $attempt->score,
                $attempt->duration_seconds / 60,
                $attempt->status,
                $attempt->synced_at->format('Y-m-d H:i:s')
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename=results_summary.csv');
    }

    public function exportDepartmentReport(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $departments = Department::with('students', 'subjects')->get();

        $csv = "Department,Class Level,Students,Active Subjects,Active\n";
        foreach ($departments as $dept) {
            $csv .= sprintf(
                "%s,%s,%d,%d,%s\n",
                $dept->name,
                $dept->class_level,
                $dept->students->count(),
                $dept->subjects->count(),
                $dept->is_active ? 'Yes' : 'No'
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename=department_report.csv');
    }

    public function exportPerformanceAnalytics(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $exams = Exam::with('attempts')->get();

        $csv = "Exam Title,Total Attempts,Average Score,Pass Rate (>50%),Highest Score,Lowest Score\n";
        foreach ($exams as $exam) {
            $attempts = $exam->attempts->where('status', 'released');
            $passCount = $attempts->where('score', '>=', 50)->count();
            $totalCount = $attempts->count();

            $csv .= sprintf(
                "%s,%d,%.2f,%.1f%%,%s,%s\n",
                $exam->title,
                $totalCount,
                $attempts->average('score') ?? 0,
                $totalCount > 0 ? ($passCount / $totalCount) * 100 : 0,
                $attempts->max('score') ?? 'N/A',
                $attempts->min('score') ?? 'N/A'
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename=performance_analytics.csv');
    }
}
