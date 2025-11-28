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

class ReportController extends Controller
{
    /**
     * Download exam report as PDF
     */
    public function downloadExamReportPdf($examId)
    {
        $exam = \App\Models\Exam::with(['subject', 'attempts' => function($q) {
            $q->where('status', 'completed')->with('student.department');
        }])->findOrFail($examId);

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
    public function downloadExamReportExcel($examId)
    {
        return Excel::download(
            new ExamResultsExport($examId), 
            'exam_report_' . $examId . '.xlsx'
        );
    }

    /**
     * Download student results as PDF
     */
    public function downloadStudentResultsPdf($studentId)
    {
        $student = Student::with(['department', 'examAttempts' => function($q) {
            $q->where('status', 'completed')->with('exam.subject');
        }])->findOrFail($studentId);

        $attempts = $student->examAttempts->sortByDesc('completed_at');

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
    public function downloadStudentResultsExcel($studentId)
    {
        $student = Student::findOrFail($studentId);
        
        return Excel::download(
            new StudentResultsExport($studentId), 
            'student_results_' . $student->registration_number . '.xlsx'
        );
    }

    /**
     * Download detailed attempt report as PDF
     */
    public function downloadAttemptReportPdf($attemptId)
    {
        $attempt = ExamAttempt::with([
            'exam.subject',
            'student.department',
            'examAnswers.question.options'
        ])->findOrFail($attemptId);

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
}
