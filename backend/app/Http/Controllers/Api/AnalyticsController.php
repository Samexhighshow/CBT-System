<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Models\Department;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnalyticsController extends Controller
{
    /**
     * Get admin dashboard statistics
     */
    public function getAdminDashboardStats()
    {
        try {
            $stats = [
                'total_students' => Student::count(),
                'active_students' => Student::where('is_active', true)->count(),
                'total_exams' => Exam::count(),
                'published_exams' => Exam::where('published', true)->count(),
                'total_departments' => Department::count(),
                'total_subjects' => Subject::count(),
                'total_attempts' => ExamAttempt::where('status', 'completed')->count(),
                'ongoing_exams' => Exam::where('published', true)->count(),
            ];

            // Recent activity
            $stats['recent_attempts'] = ExamAttempt::with(['student', 'exam'])
                ->where('status', 'completed')
                ->orderBy('ended_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function($attempt) {
                    if (!$attempt->student || !$attempt->exam) {
                        return null;
                    }
                    return [
                        'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                        'exam_title' => $attempt->exam->title,
                        'score' => $attempt->score,
                        'total_marks' => $attempt->exam->metadata['total_marks'] ?? null,
                        'completed_at' => $attempt->ended_at,
                    ];
                })
                ->filter();

            // Performance trends (last 30 days)
            $stats['performance_trend'] = $this->getPerformanceTrend(30);

            return response()->json($stats);
        } catch (\Exception $e) {
            Log::error('Analytics error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to fetch analytics',
                'message' => $e->getMessage(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    /**
     * Get student dashboard statistics
     */
    public function getStudentDashboardStats($studentId)
    {
        $student = Student::findOrFail($studentId);

        $attempts = ExamAttempt::where('student_id', $studentId)
            ->whereIn('status', ['completed', 'submitted'])
            ->with('exam.subject')
            ->get();

        $now = now();
        $availableExamsQuery = Exam::query()
            ->where('published', true)
            ->whereIn('status', ['scheduled', 'active'])
            ->when($student->class_id, fn($q) => $q->where('class_id', $student->class_id))
            ->when(!$student->class_id && $student->class_level, fn($q) => $q->where('class_level', $student->class_level))
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('start_datetime')->whereNull('start_time');
                })
                ->orWhere('start_datetime', '<=', $now)
                ->orWhere('start_time', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('end_datetime')->whereNull('end_time');
                })
                ->orWhere('end_datetime', '>=', $now)
                ->orWhere('end_time', '>=', $now);
            });

        $availableExams = $availableExamsQuery->count();

        $attemptMetrics = $attempts->map(function ($attempt) {
            $score = (float) ($attempt->score ?? 0);
            $totalMarks = $this->resolveExamTotalMarks($attempt->exam);
            $passingMarks = $this->resolveExamPassingMarks($attempt->exam, $totalMarks);
            $percentage = $this->safePercentage($score, $totalMarks) ?? 0;

            return [
                'attempt' => $attempt,
                'score' => $score,
                'total_marks' => $totalMarks,
                'passing_marks' => $passingMarks,
                'percentage' => $percentage,
                'passed' => $passingMarks !== null ? $score >= $passingMarks : ($percentage >= 50),
            ];
        });

        $stats = [
            'total_exams_taken' => $attempts->count(),
            'available_exams' => $availableExams,
            'average_score' => $attemptMetrics->isNotEmpty()
                ? round($attemptMetrics->avg('percentage'), 2)
                : 0,
            'total_marks_obtained' => round($attemptMetrics->sum('score'), 2),
            'highest_score' => $attemptMetrics->isNotEmpty()
                ? round((float) $attemptMetrics->max('score'), 2)
                : 0,
            'pass_rate' => $attemptMetrics->isNotEmpty()
                ? round(($attemptMetrics->where('passed', true)->count() / $attemptMetrics->count()) * 100, 2)
                : 0,
        ];

        $stats['recent_results'] = $attemptMetrics
            ->sortByDesc(function ($metric) {
                $attempt = $metric['attempt'];
                return $attempt->completed_at ?? $attempt->submitted_at ?? $attempt->ended_at ?? $attempt->updated_at;
            })
            ->take(5)
            ->map(function ($metric) {
                /** @var ExamAttempt $attempt */
                $attempt = $metric['attempt'];
                $exam = $attempt->exam;

                return [
                    'exam_title' => $exam?->title,
                    'score' => $metric['score'],
                    'total_marks' => $metric['total_marks'],
                    'percentage' => round((float) $metric['percentage'], 2),
                    'passed' => (bool) $metric['passed'],
                    'status' => $attempt->status,
                    'completed_at' => $attempt->completed_at ?? $attempt->submitted_at ?? $attempt->ended_at,
                ];
            })
            ->values();

        $stats['performance_by_subject'] = $this->getStudentPerformanceBySubject($attempts);

        return response()->json($stats);
    }

    /**
     * Get performance metrics
     */
    public function getPerformanceMetrics(Request $request)
    {
        $query = ExamAttempt::where('status', 'completed');

        // Apply filters
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        if ($request->has('department_id')) {
            $query->whereHas('student', function($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }

        if ($request->has('start_date')) {
            $query->where('ended_at', '>=', $request->start_date);
        }

        if ($request->has('end_date')) {
            $query->where('ended_at', '<=', $request->end_date);
        }

        $attempts = $query->with(['exam', 'student'])->get();

        $metrics = [
            'total_attempts' => $attempts->count(),
            'average_score' => round($attempts->avg('score'), 2),
            'median_score' => $this->calculateMedian($attempts->pluck('score')->toArray()),
            'highest_score' => $attempts->max('score'),
            'lowest_score' => $attempts->min('score'),
            'standard_deviation' => $this->calculateStandardDeviation($attempts->pluck('score')->toArray()),
            'pass_rate' => $this->calculatePassRate($attempts),
            'score_distribution' => $this->getScoreDistribution($attempts),
            'top_performers' => $this->getTopPerformers($attempts, 10),
            'struggling_students' => $this->getStrugglingStudents($attempts, 10),
        ];

        return response()->json($metrics);
    }

    /**
     * Get exam comparison analytics
     */
    public function getExamComparison(Request $request)
    {
        $validated = $request->validate([
            'exam_ids' => 'required|array|min:2',
            'exam_ids.*' => 'exists:exams,id',
        ]);

        $comparison = [];

        foreach ($validated['exam_ids'] as $examId) {
            $exam = Exam::findOrFail($examId);
            $attempts = ExamAttempt::where('exam_id', $examId)
                ->where('status', 'completed')
                ->get();

            $comparison[] = [
                'exam_id' => $exam->id,
                'exam_title' => $exam->title,
                'subject' => $exam->metadata['subject'] ?? null,
                'total_attempts' => $attempts->count(),
                'average_score' => round($attempts->avg('score'), 2),
                'pass_rate' => $this->calculatePassRate($attempts),
                'highest_score' => $attempts->max('score'),
                'lowest_score' => $attempts->min('score'),
            ];
        }

        return response()->json($comparison);
    }

    /**
     * Get department performance
     */
    public function getDepartmentPerformance()
    {
        $departments = Department::with(['students.examAttempts' => function($q) {
            $q->where('status', 'completed');
        }])->get();

        $performance = $departments->map(function($dept) {
            $attempts = $dept->students->flatMap->examAttempts;
            
            return [
                'department_name' => $dept->name,
                'total_students' => $dept->students->count(),
                'total_attempts' => $attempts->count(),
                'average_score' => round($attempts->avg('score'), 2),
                'pass_rate' => $this->calculatePassRate($attempts),
            ];
        });

        return response()->json($performance);
    }

    /**
     * Helper: Calculate performance trend
     */
    private function getPerformanceTrend($days)
    {
        $trend = [];
        $startDate = now()->subDays($days);

        for ($i = 0; $i < $days; $i++) {
            $date = $startDate->copy()->addDays($i);
            $attempts = ExamAttempt::whereDate('ended_at', $date)
                ->where('status', 'completed')
                ->get();

            $trend[] = [
                'date' => $date->format('Y-m-d'),
                'total_attempts' => $attempts->count(),
                'average_score' => round($attempts->avg('score'), 2),
            ];
        }

        return $trend;
    }

    /**
     * Helper: Calculate student pass rate
     */
    private function safePercentage($score, $total)
    {
        if (!$total || $total <= 0) return null;
        return round(($score / $total) * 100, 2);
    }

    private function safePassed($score, $passing)
    {
        if ($passing === null) return null;
        return $score >= $passing;
    }

    private function resolveExamTotalMarks($exam): ?float
    {
        if (!$exam) {
            return null;
        }

        $direct = $exam->total_marks ?? null;
        if ($direct !== null && is_numeric($direct) && (float) $direct > 0) {
            return (float) $direct;
        }

        $metaTotal = data_get($exam->metadata, 'total_marks');
        if ($metaTotal !== null && is_numeric($metaTotal) && (float) $metaTotal > 0) {
            return (float) $metaTotal;
        }

        $computed = (float) ($exam->questions()->sum('marks') ?? 0);
        return $computed > 0 ? $computed : null;
    }

    private function resolveExamPassingMarks($exam, ?float $totalMarks = null): ?float
    {
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
            return round($totalMarks * 0.5, 2);
        }

        return null;
    }

    /**
     * Helper: Get student performance by subject
     */
    private function getStudentPerformanceBySubject($attempts)
    {
        $bySubject = [];

        foreach ($attempts as $attempt) {
            $subject = $attempt->exam->metadata['subject'] ?? 'Unknown';
            
            if (!isset($bySubject[$subject])) {
                $bySubject[$subject] = [
                    'attempts' => 0,
                    'total_score' => 0,
                    'average_score' => 0,
                ];
            }

            $bySubject[$subject]['attempts']++;
            $bySubject[$subject]['total_score'] += $attempt->score;
        }

        foreach ($bySubject as $subject => &$data) {
            $data['average_score'] = round($data['total_score'] / $data['attempts'], 2);
        }

        return $bySubject;
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
            $passing_marks = $attempt->exam->metadata['passing_marks'] ?? null;
            if ($passing_marks === null) {
                return false;
            }
            return $attempt->score >= $passing_marks;
        })->count();

        return round(($passed / $attempts->count()) * 100, 2);
    }

    /**
     * Helper: Get score distribution
     */
    private function getScoreDistribution($attempts)
    {
        $distribution = [
            '0-25%' => 0,
            '26-50%' => 0,
            '51-75%' => 0,
            '76-100%' => 0,
        ];

        foreach ($attempts as $attempt) {
            $total = $attempt->exam->metadata['total_marks'] ?? null;
            if (!$total || $total <= 0) { continue; }
            $percentage = ($attempt->score / $total) * 100;
            
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
     * Helper: Get top performers
     */
    private function getTopPerformers($attempts, $limit = 10)
    {
        return $attempts->sortByDesc('score')
            ->take($limit)
            ->map(function($attempt) {
                return [
                    'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                    'registration_number' => $attempt->student->registration_number,
                    'score' => $attempt->score,
                    'total_marks' => $attempt->exam->metadata['total_marks'] ?? null,
                    'percentage' => $this->safePercentage($attempt->score, $attempt->exam->metadata['total_marks'] ?? null),
                ];
            })
            ->values();
    }

    /**
     * Helper: Get struggling students
     */
    private function getStrugglingStudents($attempts, $limit = 10)
    {
        return $attempts->sortBy('score')
            ->take($limit)
            ->map(function($attempt) {
                return [
                    'student_name' => $attempt->student->first_name . ' ' . $attempt->student->last_name,
                    'registration_number' => $attempt->student->registration_number,
                    'score' => $attempt->score,
                    'total_marks' => $attempt->exam->metadata['total_marks'] ?? null,
                    'percentage' => $this->safePercentage($attempt->score, $attempt->exam->metadata['total_marks'] ?? null),
                ];
            })
            ->values();
    }

    /**
     * Helper: Calculate median
     */
    private function calculateMedian($values)
    {
        if (empty($values)) {
            return 0;
        }

        sort($values);
        $count = count($values);
        $middle = floor($count / 2);

        if ($count % 2 == 0) {
            return ($values[$middle - 1] + $values[$middle]) / 2;
        }

        return $values[$middle];
    }

    /**
     * Helper: Calculate standard deviation
     */
    private function calculateStandardDeviation($values)
    {
        if (empty($values)) {
            return 0;
        }

        $mean = array_sum($values) / count($values);
        $variance = array_sum(array_map(function($x) use ($mean) {
            return pow($x - $mean, 2);
        }, $values)) / count($values);

        return round(sqrt($variance), 2);
    }
}
