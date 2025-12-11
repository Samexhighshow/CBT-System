<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Models\Exam;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResultController extends Controller
{
    /**
     * Get results for a specific student
     */
    public function getStudentResults(Request $request, $studentId)
    {
        $student = Student::findOrFail($studentId);
        
        $query = ExamAttempt::with(['exam.subject'])
            ->where('student_id', $studentId)
            ->where('status', 'completed')
            ->orderBy('completed_at', 'desc');

        $perPage = $request->input('limit', 15);
        $attempts = $query->paginate($perPage);

        $results = $attempts->getCollection()->map(function($attempt) {
            return [
                'id' => $attempt->id,
                'exam_title' => $attempt->exam->title,
                'subject' => $attempt->exam->subject->name,
                'score' => $attempt->score,
                'total_marks' => $attempt->exam->total_marks,
                'percentage' => round(($attempt->score / $attempt->exam->total_marks) * 100, 2),
                'passing_marks' => $attempt->exam->passing_marks,
                'passed' => $attempt->score >= $attempt->exam->passing_marks,
                'started_at' => $attempt->started_at,
                'completed_at' => $attempt->completed_at,
                'duration' => $attempt->started_at->diffInMinutes($attempt->completed_at),
            ];
        });

        return response()->json([
            'data' => $results,
            'current_page' => $attempts->currentPage(),
            'last_page' => $attempts->lastPage(),
            'per_page' => $attempts->perPage(),
            'total' => $attempts->total(),
            'next_page' => $attempts->currentPage() < $attempts->lastPage() ? $attempts->currentPage() + 1 : null,
            'prev_page' => $attempts->currentPage() > 1 ? $attempts->currentPage() - 1 : null,
        ]);
    }

    /**
     * Get results for a specific exam
     */
    public function getExamResults(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);
        
        $query = ExamAttempt::with(['student.department'])
            ->where('exam_id', $examId)
            ->where('status', 'completed')
            ->orderBy('score', 'desc');

        $perPage = $request->input('limit', 15);
        $attempts = $query->paginate($perPage);

        $results = $attempts->getCollection()->map(function($attempt) use ($exam) {
            return [
                'id' => $attempt->id,
                'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                'registration_number' => $attempt->student->registration_number,
                'department' => $attempt->student->department->name ?? 'N/A',
                'class_level' => $attempt->student->class_level,
                'score' => $attempt->score,
                'total_marks' => $exam->total_marks,
                'percentage' => round(($attempt->score / $exam->total_marks) * 100, 2),
                'passed' => $attempt->score >= $exam->passing_marks,
                'completed_at' => $attempt->completed_at,
                'duration' => $attempt->started_at->diffInMinutes($attempt->completed_at),
            ];
        });

        return response()->json([
            'data' => $results,
            'current_page' => $attempts->currentPage(),
            'last_page' => $attempts->lastPage(),
            'per_page' => $attempts->perPage(),
            'total' => $attempts->total(),
            'next_page' => $attempts->currentPage() < $attempts->lastPage() ? $attempts->currentPage() + 1 : null,
            'prev_page' => $attempts->currentPage() > 1 ? $attempts->currentPage() - 1 : null,
        ]);
    }

    /**
     * Get analytics for results
     */
    public function getAnalytics(Request $request)
    {
        $query = ExamAttempt::where('status', 'completed');

        // Filter by exam
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by student
        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->where('completed_at', '>=', $request->start_date);
        }

        if ($request->has('end_date')) {
            $query->where('completed_at', '<=', $request->end_date);
        }

        $results = $query->with(['exam', 'student'])->get();

        $analytics = [
            'total_attempts' => $results->count(),
            'average_score' => round($results->avg('score'), 2),
            'highest_score' => $results->max('score'),
            'lowest_score' => $results->min('score'),
            'pass_rate' => $this->calculatePassRate($results),
            'score_distribution' => $this->getScoreDistribution($results),
            'performance_by_subject' => $this->getPerformanceBySubject($results),
        ];

        return response()->json($analytics);
    }

    /**
     * Calculate pass rate
     */
    private function calculatePassRate($results)
    {
        if ($results->isEmpty()) {
            return 0;
        }

        $passed = $results->filter(function($attempt) {
            return $attempt->score >= $attempt->exam->passing_marks;
        })->count();

        return round(($passed / $results->count()) * 100, 2);
    }

    /**
     * Get score distribution
     */
    private function getScoreDistribution($results)
    {
        $distribution = [
            '0-25%' => 0,
            '26-50%' => 0,
            '51-75%' => 0,
            '76-100%' => 0,
        ];

        foreach ($results as $attempt) {
            $percentage = ($attempt->score / $attempt->exam->total_marks) * 100;
            
            if ($percentage <= 25) {
                $distribution['0-25%']++;
            } elseif ($percentage <= 50) {
                $distribution['26-50%']++;
            } elseif ($percentage <= 75) {
                $distribution['51-75%']++;
            } else {
                $distribution['76-100%']++;
            }
        }

        return $distribution;
    }

    /**
     * Get performance by subject
     */
    private function getPerformanceBySubject($results)
    {
        $bySubject = [];

        foreach ($results as $attempt) {
            $subjectName = $attempt->exam->subject->name;
            
            if (!isset($bySubject[$subjectName])) {
                $bySubject[$subjectName] = [
                    'total_attempts' => 0,
                    'total_score' => 0,
                    'average_score' => 0,
                ];
            }

            $bySubject[$subjectName]['total_attempts']++;
            $bySubject[$subjectName]['total_score'] += $attempt->score;
        }

        foreach ($bySubject as $subject => &$data) {
            $data['average_score'] = round($data['total_score'] / $data['total_attempts'], 2);
        }

        return $bySubject;
    }

    /**
     * Get detailed result for a specific attempt
     */
    public function getAttemptDetails($attemptId)
    {
        $attempt = ExamAttempt::with([
            'exam.subject',
            'student.department',
            'examAnswers.question.options'
        ])->findOrFail($attemptId);

        $questions = $attempt->examAnswers->map(function($answer) {
            $correctOption = $answer->question->options->where('is_correct', true)->first();
            $isCorrect = $answer->selected_option === $correctOption->option_text;

            return [
                'question_text' => $answer->question->question_text,
                'question_type' => $answer->question->question_type,
                'marks' => $answer->question->marks,
                'selected_answer' => $answer->selected_option ?? $answer->answer_text,
                'correct_answer' => $correctOption->option_text ?? null,
                'is_correct' => $isCorrect,
                'marks_obtained' => $isCorrect ? $answer->question->marks : 0,
            ];
        });

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'exam_title' => $attempt->exam->title,
                'subject' => $attempt->exam->subject->name,
                'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                'registration_number' => $attempt->student->registration_number,
                'score' => $attempt->score,
                'total_marks' => $attempt->exam->total_marks,
                'percentage' => round(($attempt->score / $attempt->exam->total_marks) * 100, 2),
                'passed' => $attempt->score >= $attempt->exam->passing_marks,
                'started_at' => $attempt->started_at,
                'completed_at' => $attempt->completed_at,
            ],
            'questions' => $questions,
        ]);
    }
}
