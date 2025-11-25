<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ExamAttempt;
use App\Models\Exam;

class ResultController extends Controller
{
    public function releaseResults(Request $request, $examId)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'released_at' => 'nullable|date',
            'show_answers' => 'boolean|nullable'
        ]);

        $exam = Exam::findOrFail($examId);
        $attempts = ExamAttempt::where('exam_id', $examId)
            ->where('status', 'scored')
            ->update([
                'status' => 'released',
                'released_at' => $data['released_at'] ?? now()
            ]);

        return response()->json([
            'message' => "Results released for $attempts attempts",
            'attempts_released' => $attempts
        ]);
    }

    public function getStudentResults(Request $request)
    {
        $studentId = auth()->user()->student_id ?? auth()->id();
        
        $results = ExamAttempt::where('student_id', $studentId)
            ->where('status', 'released')
            ->with('exam')
            ->get()
            ->map(function ($attempt) {
                return [
                    'exam_title' => $attempt->exam->title,
                    'score' => $attempt->score,
                    'duration_seconds' => $attempt->duration_seconds,
                    'submitted_at' => $attempt->synced_at,
                    'status' => 'released'
                ];
            });

        return response()->json(['results' => $results]);
    }

    public function getExamResults($examId)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin', 'Moderator'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $exam = Exam::findOrFail($examId);
        $attempts = ExamAttempt::where('exam_id', $examId)
            ->with('student')
            ->get()
            ->map(function ($attempt) {
                return [
                    'student_id' => $attempt->student_id,
                    'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                    'score' => $attempt->score,
                    'status' => $attempt->status,
                    'submitted_at' => $attempt->synced_at,
                    'duration_seconds' => $attempt->duration_seconds
                ];
            });

        $stats = [
            'total_attempts' => $attempts->count(),
            'average_score' => $attempts->average('score') ?? 0,
            'highest_score' => $attempts->max('score') ?? 0,
            'lowest_score' => $attempts->min('score') ?? 0
        ];

        return response()->json([
            'exam' => $exam,
            'stats' => $stats,
            'results' => $attempts
        ]);
    }

    public function exportCSV($examId)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $exam = Exam::findOrFail($examId);
        $attempts = ExamAttempt::where('exam_id', $examId)
            ->with('student')
            ->get();

        $csv = "Student ID,Student Name,Score,Status,Submitted At,Duration (minutes)\n";
        foreach ($attempts as $attempt) {
            $csv .= sprintf(
                "%s,%s,%s,%s,%s,%d\n",
                $attempt->student->student_id,
                $attempt->student->first_name . ' ' . $attempt->student->last_name,
                $attempt->score,
                $attempt->status,
                $attempt->synced_at,
                $attempt->duration_seconds / 60
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', "attachment; filename=exam_{$examId}_results.csv");
    }

    public function getAnalytics(Request $request)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $dateFrom = $request->query('from', now()->subMonth()->toDateString());
        $dateTo = $request->query('to', now()->toDateString());

        $attempts = ExamAttempt::whereBetween('synced_at', [$dateFrom, $dateTo])
            ->get();

        $analytics = [
            'total_attempts' => $attempts->count(),
            'average_score' => $attempts->average('score') ?? 0,
            'completion_rate' => ($attempts->where('status', 'released')->count() / max($attempts->count(), 1)) * 100,
            'average_duration_minutes' => $attempts->average('duration_seconds') / 60,
            'attempts_by_exam' => $attempts->groupBy('exam_id')->map(function ($group) {
                return [
                    'exam_id' => $group->first()->exam_id,
                    'count' => $group->count(),
                    'average_score' => $group->average('score')
                ];
            })
        ];

        return response()->json(['analytics' => $analytics]);
    }
}
