<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Models\Exam;
use App\Models\Question;
use App\Services\GradingService;
use Illuminate\Http\Request;

class ResultController extends Controller
{
    /**
     * Get results for a specific student
     */
    public function getStudentResults(Request $request, $studentId)
    {
        $student = Student::findOrFail($studentId);
        $grading = $this->gradingService();
        
        $query = ExamAttempt::with(['exam.subject'])
            ->where('student_id', $studentId)
            ->where('status', 'completed')
            ->orderBy('completed_at', 'desc');

        $perPage = $request->input('limit', 15);
        $attempts = $query->paginate($perPage);

        $results = $attempts->getCollection()->map(function($attempt) use ($grading) {
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            $safeTotal = max(1, (float) $totalMarks);
            $percentage = round(($attempt->score / $safeTotal) * 100, 2);
            $passed = $this->hasPassed((float) ($attempt->score ?? 0), $totalMarks, $passingMarks);

            return [
                'id' => $attempt->id,
                'exam_title' => $attempt->exam->title,
                'subject' => $attempt->exam->subject->name,
                'score' => $attempt->score,
                'total_marks' => $totalMarks,
                'percentage' => $percentage,
                'passing_marks' => $passingMarks,
                'passed' => $passed,
                'grade' => $grading->gradeFromPercentage($percentage),
                'position_grade' => $grading->positionBandFromPercentage($percentage),
                'started_at' => $attempt->started_at,
                'completed_at' => $attempt->completed_at,
                'duration' => ($attempt->started_at && $attempt->completed_at)
                    ? $attempt->started_at->diffInMinutes($attempt->completed_at)
                    : null,
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
        $grading = $this->gradingService();
        
        $query = ExamAttempt::with(['student.department'])
            ->where('exam_id', $examId)
            ->where('status', 'completed')
            ->orderBy('score', 'desc');

        $perPage = $request->input('limit', 15);
        $attempts = $query->paginate($perPage);
        $rankings = $this->buildExamRankingMap((int) $examId);

        $results = $attempts->getCollection()->map(function($attempt) use ($exam, $grading, $rankings) {
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            $safeTotal = max(1, (float) $totalMarks);
            $percentage = round(($attempt->score / $safeTotal) * 100, 2);
            $passed = $this->hasPassed((float) ($attempt->score ?? 0), $totalMarks, $passingMarks);
            $rank = $rankings[$attempt->id] ?? null;

            return [
                'id' => $attempt->id,
                'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                'registration_number' => $attempt->student->registration_number,
                'department' => $attempt->student->department->name ?? 'N/A',
                'class_level' => $attempt->student->class_level,
                'score' => $attempt->score,
                'total_marks' => $totalMarks,
                'percentage' => $percentage,
                'passed' => $passed,
                'grade' => $grading->gradeFromPercentage($percentage),
                'position_grade' => $grading->positionBandFromPercentage($percentage),
                'rank_position' => $rank,
                'rank_label' => $grading->ordinalPosition($rank),
                'completed_at' => $attempt->completed_at,
                'duration' => ($attempt->started_at && $attempt->completed_at)
                    ? $attempt->started_at->diffInMinutes($attempt->completed_at)
                    : null,
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
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            return $this->hasPassed((float) ($attempt->score ?? 0), $totalMarks, $passingMarks);
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
            $total = max(1, (float) $this->resolveAttemptTotalMarks($attempt));
            $percentage = ((float) $attempt->score / $total) * 100;
            
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
        $grading = $this->gradingService();
        $attempt = ExamAttempt::with([
            'exam.subject',
            'student.department',
            'examAnswers.question.options'
        ])->findOrFail($attemptId);

        $questions = $attempt->examAnswers->map(function($answer) {
            $correctOption = $answer->question->options->where('is_correct', true)->first();
            $isCorrect = $answer->option_id && $correctOption
                ? (int) $answer->option_id === (int) $correctOption->id
                : false;
            $selectedAnswerText = $answer->option?->option_text ?? $answer->answer_text;

            return [
                'question_text' => $answer->question->question_text,
                'question_type' => $answer->question->question_type,
                'marks' => $answer->question->marks,
                'selected_answer' => $selectedAnswerText,
                'correct_answer' => $correctOption?->option_text,
                'is_correct' => $isCorrect,
                'marks_obtained' => $isCorrect ? $answer->question->marks : 0,
            ];
        });

        $totalMarks = $this->resolveAttemptTotalMarks($attempt);
        $safeTotal = max(1, (float) $totalMarks);
        $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
        $percentage = round(($attempt->score / $safeTotal) * 100, 2);
        $passed = $this->hasPassed((float) ($attempt->score ?? 0), $totalMarks, $passingMarks);
        $rankings = $this->buildExamRankingMap((int) $attempt->exam_id);
        $rank = $rankings[$attempt->id] ?? null;

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'exam_title' => $attempt->exam->title,
                'subject' => $attempt->exam->subject->name,
                'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                'registration_number' => $attempt->student->registration_number,
                'score' => $attempt->score,
                'total_marks' => $totalMarks,
                'percentage' => $percentage,
                'passed' => $passed,
                'grade' => $grading->gradeFromPercentage($percentage),
                'position_grade' => $grading->positionBandFromPercentage($percentage),
                'rank_position' => $rank,
                'rank_label' => $grading->ordinalPosition($rank),
                'started_at' => $attempt->started_at,
                'completed_at' => $attempt->completed_at,
            ],
            'questions' => $questions,
        ]);
    }

    private function resolveAttemptTotalMarks(ExamAttempt $attempt): float
    {
        $questionIds = collect($attempt->question_order ?: [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values();

        if ($questionIds->isEmpty()) {
            $questionIds = Question::where('exam_id', $attempt->exam_id)
                ->orderBy('order_index')
                ->orderBy('id')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        if ($questionIds->isEmpty()) {
            return 0;
        }

        $questions = Question::with('bankQuestion:id,marks')
            ->whereIn('id', $questionIds)
            ->get();

        return (float) $questions->sum(function (Question $question) {
            if (($question->marks_override ?? null) !== null) {
                return (float) $question->marks_override;
            }

            if (($question->marks ?? null) !== null) {
                return (float) $question->marks;
            }

            if (($question->bankQuestion?->marks ?? null) !== null) {
                return (float) $question->bankQuestion->marks;
            }

            return 1.0;
        });
    }

    private function resolveAttemptPassingMarks(ExamAttempt $attempt, ?float $totalMarks = null): ?float
    {
        $exam = $attempt->exam;
        if (!$exam) {
            return null;
        }

        $direct = $exam->passing_marks ?? null;
        if ($direct !== null && is_numeric($direct)) {
            return (float) $direct;
        }

        $metaPassing = data_get($exam->metadata, 'passing_marks');
        if ($metaPassing !== null && is_numeric($metaPassing)) {
            return (float) $metaPassing;
        }

        if ($totalMarks !== null && $totalMarks > 0) {
            $passMarkPercent = $this->gradingService()->passMarkPercentage() / 100;
            return round($totalMarks * $passMarkPercent, 2);
        }

        return null;
    }

    private function hasPassed(float $score, float $totalMarks, ?float $passingMarks = null): bool
    {
        if ($passingMarks !== null) {
            return $score >= $passingMarks;
        }

        if ($totalMarks <= 0) {
            return false;
        }

        $percentage = ($score / max(1, $totalMarks)) * 100;
        return $this->gradingService()->didPassPercentage($percentage);
    }

    private function gradingService(): GradingService
    {
        return app(GradingService::class);
    }

    private function buildExamRankingMap(int $examId): array
    {
        $attempts = ExamAttempt::query()
            ->where('exam_id', $examId)
            ->where('status', 'completed')
            ->orderByDesc('score')
            ->orderBy('completed_at')
            ->orderBy('id')
            ->get(['id', 'score']);

        $rankMap = [];
        $currentRank = 0;
        $position = 0;
        $previousScore = null;

        foreach ($attempts as $attempt) {
            $position++;
            $score = (float) ($attempt->score ?? 0);

            if ($previousScore === null || $score < $previousScore) {
                $currentRank = $position;
                $previousScore = $score;
            }

            $rankMap[$attempt->id] = $currentRank;
        }

        return $rankMap;
    }
}
