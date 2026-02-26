<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Student;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ExamResultsExport;
use App\Exports\StudentResultsExport;
use App\Services\RoleScopeService;

class ReportController extends Controller
{
    public function __construct(
        private readonly RoleScopeService $roleScopeService
    ) {
    }

    public function downloadMyResultsPdf(Request $request)
    {
        $student = $this->resolveAuthStudent($request->user());
        if (!$student) {
            return response()->json(['message' => 'Student profile not found for this account.'], 404);
        }

        return $this->downloadStudentResultsPdf((int) $student->id, $request);
    }

    public function downloadMyResultsExcel(Request $request)
    {
        $student = $this->resolveAuthStudent($request->user());
        if (!$student) {
            return response()->json(['message' => 'Student profile not found for this account.'], 404);
        }

        return $this->downloadStudentResultsExcel((int) $student->id, $request);
    }

    /**
     * Download exam report as PDF
     */
    public function downloadExamReportPdf($examId, Request $request)
    {
        if (!$this->isStaffRole($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $exam = \App\Models\Exam::with(['subject', 'attempts' => function($q) {
            $q->whereIn('status', ['completed', 'submitted'])->with('student.department');
        }])->findOrFail($examId);

        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $attempts = $exam->attempts->sortByDesc('score');

        $data = [
            'exam' => $exam,
            'attempts' => $attempts,
            'total_attempts' => $attempts->count(),
            'average_score' => round($attempts->avg('score'), 2),
            'highest_score' => $attempts->max('score'),
            'lowest_score' => $attempts->min('score'),
            'pass_rate' => $this->calculatePassRate($attempts),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.exam-report', $data);
        
        return $pdf->download('exam_report_' . $exam->id . '.pdf');
    }

    /**
     * Download exam report as Excel
     */
    public function downloadExamReportExcel($examId, Request $request)
    {
        if (!$this->isStaffRole($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return Excel::download(
            new ExamResultsExport($examId), 
            'exam_report_' . $examId . '.xlsx'
        );
    }

    /**
     * Download student results as PDF
     */
    public function downloadStudentResultsPdf($studentId, ?Request $request = null)
    {
        $authUser = $request?->user();
        $isStudent = $this->isStudentRole($authUser);
        $isStaff = $this->isStaffRole($authUser);

        if (!$isStudent && !$isStaff) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($isStudent) {
            $authStudent = $this->resolveAuthStudent($authUser);
            if (!$authStudent || (int) $authStudent->id !== (int) $studentId) {
                return response()->json(['message' => 'You can only access your own report.'], 403);
            }
        }

        $student = Student::with(['department'])->findOrFail($studentId);

        $attemptsQuery = $student->examAttempts()
            ->whereIn('status', ['completed', 'submitted'])
            ->with('exam.subject');
        if ($isStaff && $this->roleScopeService->isScopedActor($authUser)) {
            $attemptsQuery->whereHas('exam', function ($q) use ($authUser) {
                $this->roleScopeService->applyExamScope($q, $authUser);
            });
        }
        if ($isStudent) {
            $attemptsQuery->whereHas('exam', function ($q) {
                $q->where('results_released', true);
            });
        }
        $attempts = $attemptsQuery->get()->sortByDesc('completed_at');

        if ($isStudent && $attempts->isEmpty()) {
            return response()->json([
                'status' => 'not_released',
                'message' => 'Results have not been released yet.',
            ], 403);
        }

        $data = [
            'student' => $student,
            'attempts' => $attempts,
            'total_exams' => $attempts->count(),
            'average_score' => round($attempts->avg('score'), 2),
            'highest_score' => $attempts->max('score'),
            'pass_rate' => $this->calculatePassRate($attempts),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.student-results', $data);
        
        return $pdf->download('student_results_' . $student->registration_number . '.pdf');
    }

    /**
     * Download student results as Excel
     */
    public function downloadStudentResultsExcel($studentId, ?Request $request = null)
    {
        $authUser = $request?->user();
        $isStudent = $this->isStudentRole($authUser);
        $isStaff = $this->isStaffRole($authUser);
        if (!$isStudent && !$isStaff) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($isStudent) {
            $authStudent = $this->resolveAuthStudent($authUser);
            if (!$authStudent || (int) $authStudent->id !== (int) $studentId) {
                return response()->json(['message' => 'You can only access your own report.'], 403);
            }
        }
        if ($isStaff && $this->roleScopeService->isScopedActor($authUser)) {
            $allowedAttempts = $student->examAttempts()
                ->whereIn('status', ['completed', 'submitted'])
                ->whereHas('exam', function ($q) use ($authUser) {
                    $this->roleScopeService->applyExamScope($q, $authUser);
                })
                ->count();
            if ($allowedAttempts === 0) {
                return response()->json(['message' => 'Forbidden: no scoped results for this student.'], 403);
            }
        }

        $student = Student::findOrFail($studentId);

        if ($isStudent) {
            $releasedCount = $student->examAttempts()
                ->whereIn('status', ['completed', 'submitted'])
                ->whereHas('exam', function ($q) {
                    $q->where('results_released', true);
                })
                ->count();
            if ($releasedCount === 0) {
                return response()->json([
                    'status' => 'not_released',
                    'message' => 'Results have not been released yet.',
                ], 403);
            }
        }
        
        return Excel::download(
            new StudentResultsExport($studentId, $isStudent), 
            'student_results_' . $student->registration_number . '.xlsx'
        );
    }

    /**
     * Download detailed attempt report as PDF
     */
    public function downloadAttemptReportPdf($attemptId, Request $request)
    {
        $user = $request->user();
        $isStudent = $this->isStudentRole($user);
        $isStaff = $this->isStaffRole($user);
        if (!$isStudent && !$isStaff) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $attempt = ExamAttempt::with([
            'exam.subject',
            'student.department',
            'examAnswers.question.options'
        ])->findOrFail($attemptId);

        if ($isStaff && !$this->roleScopeService->canManageExam($user, $attempt->exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        if ($isStudent) {
            $authStudent = $this->resolveAuthStudent($user);
            if (!$authStudent || (int) $authStudent->id !== (int) $attempt->student_id) {
                return response()->json(['message' => 'You can only access your own attempt report.'], 403);
            }
            if (!(bool) ($attempt->exam?->results_released ?? false)) {
                return response()->json([
                    'status' => 'not_released',
                    'message' => 'Results have not been released yet.',
                ], 403);
            }
        }

        $questions = $attempt->examAnswers->map(function($answer) {
            $correctOption = $answer->question->options->where('is_correct', true)->first();
            $isCorrect = $answer->selected_option === ($correctOption->option_text ?? null);

            return [
                'question_text' => $answer->question->question_text,
                'selected_answer' => $answer->selected_option ?? $answer->answer_text,
                'correct_answer' => $correctOption->option_text ?? 'N/A',
                'is_correct' => $isCorrect,
                'marks' => $answer->question->marks,
                'marks_obtained' => $isCorrect ? $answer->question->marks : 0,
            ];
        });

        $data = [
            'attempt' => $attempt,
            'questions' => $questions,
            'total_questions' => $questions->count(),
            'correct_answers' => $questions->where('is_correct', true)->count(),
            'percentage' => round(($attempt->score / $attempt->exam->total_marks) * 100, 2),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.attempt-details', $data);
        
        return $pdf->download('attempt_report_' . $attemptId . '.pdf');
    }

    /**
     * Helper: Calculate pass rate
     */
    private function calculatePassRate($attempts)
    {
        if ($attempts->isEmpty()) {
            return 0;
        }

        $passed = $attempts->filter(function($attempt) {
            return $attempt->score >= $attempt->exam->passing_marks;
        })->count();

        return round(($passed / $attempts->count()) * 100, 2);
    }

    private function resolveAuthStudent($user): ?Student
    {
        if (!$user) {
            return null;
        }

        return Student::query()
            ->where('email', (string) $user->email)
            ->first();
    }

    private function roleNamesLower($user): array
    {
        if (!$user) {
            return [];
        }

        return collect($user->roles ?? [])
            ->map(fn ($role) => strtolower((string) ($role->name ?? $role)))
            ->values()
            ->all();
    }

    private function isStudentRole($user): bool
    {
        return in_array('student', $this->roleNamesLower($user), true);
    }

    private function isStaffRole($user): bool
    {
        $roles = $this->roleNamesLower($user);
        return count(array_intersect($roles, ['admin', 'main admin', 'teacher'])) > 0;
    }
}
