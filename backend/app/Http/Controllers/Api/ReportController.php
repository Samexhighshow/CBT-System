<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Exam;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Barryvdh\DomPDF\Facade\Pdf;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ExamResultsExport;
use App\Exports\StudentResultsExport;
use App\Exports\TermAggregateExport;
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

        $exam = \App\Models\Exam::with('subject')->findOrFail($examId);

        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $attempts = $this->loadExamReportAttempts($exam)->map(function (ExamAttempt $attempt) {
            $score = (float) ($attempt->score ?? 0);
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            $safeTotal = max(1.0, $totalMarks);
            $percentage = round(($score / $safeTotal) * 100, 2);
            $passed = $this->hasPassed($score, $totalMarks, $passingMarks);

            $attempt->setAttribute('report_score', $score);
            $attempt->setAttribute('report_total_marks', $totalMarks);
            $attempt->setAttribute('report_passing_marks', $passingMarks);
            $attempt->setAttribute('report_percentage', $percentage);
            $attempt->setAttribute('report_passed', $passed);
            $attempt->setAttribute('report_assessment_type', $this->resolveAssessmentTypeLabel($attempt));

            return $attempt;
        })->values();

        $distinctTotals = $attempts
            ->pluck('report_total_marks')
            ->filter(fn ($value) => is_numeric($value) && (float) $value > 0)
            ->map(fn ($value) => (float) $value)
            ->unique()
            ->values();
        $distinctPassing = $attempts
            ->pluck('report_passing_marks')
            ->filter(fn ($value) => is_numeric($value) && (float) $value >= 0)
            ->map(fn ($value) => (float) $value)
            ->unique()
            ->values();

        $examTotalMarksDisplay = $distinctTotals->count() === 1
            ? (float) $distinctTotals->first()
            : 'Varies by attempt';
        $examPassingMarksDisplay = $distinctPassing->count() === 1
            ? (float) $distinctPassing->first()
            : 'Varies by attempt';

        $startTime = $exam->start_datetime ?? $exam->start_time;
        $endTime = $exam->end_datetime ?? $exam->end_time;

        $data = [
            'exam' => $exam,
            'attempts' => $attempts,
            'exam_total_marks' => $examTotalMarksDisplay,
            'exam_passing_marks' => $examPassingMarksDisplay,
            'exam_start_time' => $startTime ? $startTime->format('Y-m-d H:i') : null,
            'exam_end_time' => $endTime ? $endTime->format('Y-m-d H:i') : null,
            'total_attempts' => $attempts->count(),
            'average_score' => round((float) $attempts->avg('report_percentage'), 2),
            'highest_score' => $attempts->max('report_score'),
            'lowest_score' => $attempts->min('report_score'),
            'pass_rate' => $this->calculatePassRate($attempts),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.exam-report', $data);
        
        return $pdf->download('exam_report_' . $exam->id . '.pdf');
    }

    private function loadExamReportAttempts(Exam $exam): Collection
    {
        $baseQuery = ExamAttempt::query()
            ->with(['student.department'])
            ->where('exam_id', $exam->id)
            ->whereNotNull('score');

        // Preferred statuses for final report rows.
        $attempts = (clone $baseQuery)
            ->whereIn('status', ['completed', 'submitted', 'scored'])
            ->get();

        // Fallback for legacy/edge statuses that still carry a valid score.
        if ($attempts->isEmpty()) {
            $attempts = (clone $baseQuery)
                ->whereNotIn('status', ['pending', 'in_progress'])
                ->get();
        }

        $sortedByFreshness = $attempts->sortByDesc(function (ExamAttempt $attempt) {
            $stamp = $attempt->completed_at
                ?? $attempt->submitted_at
                ?? $attempt->ended_at
                ?? $attempt->updated_at;

            return $stamp ? $stamp->getTimestamp() : 0;
        });

        // Keep the latest scored attempt per student, then rank by score.
        return $sortedByFreshness
            ->unique('student_id')
            ->sortByDesc(function (ExamAttempt $attempt) {
                return (float) ($attempt->score ?? 0);
            })
            ->values();
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
     * Download term aggregate report as PDF
     */
    public function downloadTermAggregatePdf(string $session, string $term, int $classId, Request $request)
    {
        if (!$this->isStaffRole($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $normalizedSession = $this->normalizeSessionSlug($session);
        $normalizedTerm = $this->normalizeTerm($term);
        if (!in_array($normalizedTerm, ['First Term', 'Second Term', 'Third Term'], true)) {
            return response()->json(['message' => 'Invalid term supplied.'], 422);
        }

        $class = SchoolClass::findOrFail($classId);
        if (!$this->roleScopeService->canManageClass($request->user(), $class)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $rows = $this->buildTermAggregateRows($normalizedSession, $normalizedTerm, $class, $request->user());

        $data = [
            'academic_session' => $normalizedSession,
            'term' => $normalizedTerm,
            'class_name' => $class->name,
            'rows' => $rows,
            'total_rows' => $rows->count(),
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.term-aggregate', $data);
        $slugTerm = strtolower(str_replace(' ', '_', $normalizedTerm));

        return $pdf->download('term_aggregate_' . $normalizedSession . '_' . $slugTerm . '_class_' . $classId . '.pdf');
    }

    /**
     * Download term aggregate report as Excel
     */
    public function downloadTermAggregateExcel(string $session, string $term, int $classId, Request $request)
    {
        if (!$this->isStaffRole($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $normalizedSession = $this->normalizeSessionSlug($session);
        $normalizedTerm = $this->normalizeTerm($term);
        if (!in_array($normalizedTerm, ['First Term', 'Second Term', 'Third Term'], true)) {
            return response()->json(['message' => 'Invalid term supplied.'], 422);
        }

        $class = SchoolClass::findOrFail($classId);
        if (!$this->roleScopeService->canManageClass($request->user(), $class)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $rows = $this->buildTermAggregateRows($normalizedSession, $normalizedTerm, $class, $request->user());
        $slugTerm = strtolower(str_replace(' ', '_', $normalizedTerm));

        return Excel::download(
            new TermAggregateExport($rows),
            'term_aggregate_' . $normalizedSession . '_' . $slugTerm . '_class_' . $classId . '.xlsx'
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

        $attempts = $attempts->map(function (ExamAttempt $attempt) {
            $score = (float) ($attempt->score ?? 0);
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            $safeTotal = max(1.0, $totalMarks);
            $percentage = round(($score / $safeTotal) * 100, 2);
            $passed = $this->hasPassed($score, $totalMarks, $passingMarks);

            $attempt->setAttribute('report_score', $score);
            $attempt->setAttribute('report_total_marks', $totalMarks);
            $attempt->setAttribute('report_passing_marks', $passingMarks);
            $attempt->setAttribute('report_percentage', $percentage);
            $attempt->setAttribute('report_passed', $passed);
            $attempt->setAttribute('report_assessment_type', $this->resolveAssessmentTypeLabel($attempt));

            return $attempt;
        })->values();

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
            'average_score' => round((float) $attempts->avg('report_percentage'), 2),
            'highest_score' => $attempts->max('report_score'),
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
        $student = Student::findOrFail($studentId);
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

        $totalMarks = $this->resolveAttemptTotalMarks($attempt);
        $safeTotal = max(1.0, $totalMarks);

        $data = [
            'attempt' => $attempt,
            'questions' => $questions,
            'total_questions' => $questions->count(),
            'correct_answers' => $questions->where('is_correct', true)->count(),
            'total_marks' => $totalMarks,
            'percentage' => round((((float) ($attempt->score ?? 0)) / $safeTotal) * 100, 2),
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
            if (isset($attempt->report_passed)) {
                return (bool) $attempt->report_passed;
            }

            $score = (float) ($attempt->score ?? 0);
            $totalMarks = $this->resolveAttemptTotalMarks($attempt);
            $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
            return $this->hasPassed($score, $totalMarks, $passingMarks);
        })->count();

        return round(($passed / $attempts->count()) * 100, 2);
    }

    private function buildTermAggregateRows(string $session, string $term, SchoolClass $class, $user): Collection
    {
        $useAssessmentWeight = filter_var(SystemSetting::get('use_exam_assessment_weight', true), FILTER_VALIDATE_BOOLEAN);
        $defaultCaWeight = $this->boundedSetting('default_ca_weight', 40, 0, 100);
        $defaultExamWeight = $this->boundedSetting('default_exam_weight', 60, 0, 100);

        $query = ExamAttempt::with([
                'student:id,registration_number,first_name,last_name,class_level,class_id',
                'exam:id,subject_id,class_id,class_level,assessment_type,assessment_weight,academic_session,term,metadata',
                'exam.subject:id,name',
            ])
            ->whereIn('status', ['completed', 'submitted'])
            ->whereHas('student', function ($q) use ($class) {
                $q->where('class_id', $class->id);
            });

        if ($this->roleScopeService->isScopedActor($user)) {
            $query->whereHas('exam', function ($q) use ($user) {
                $this->roleScopeService->applyExamScope($q, $user);
            });
        }

        $attempts = $query->get()
            ->filter(function (ExamAttempt $attempt) use ($session, $term) {
                if (!$attempt->exam || !$attempt->student) {
                    return false;
                }

                return $this->resolveExamSession($attempt->exam) === $session
                    && $this->resolveExamTerm($attempt->exam) === $term;
            })
            ->sortByDesc(function (ExamAttempt $attempt) {
                $stamp = $attempt->completed_at
                    ?? $attempt->submitted_at
                    ?? $attempt->ended_at
                    ?? $attempt->updated_at;

                return $stamp ? $stamp->getTimestamp() : 0;
            })
            ->unique(function (ExamAttempt $attempt) {
                return ((int) $attempt->student_id) . ':' . ((int) $attempt->exam_id) . ':' . $this->attemptComponent($attempt);
            })
            ->values();

        if ($attempts->isEmpty()) {
            return collect();
        }

        $records = $attempts->map(function (ExamAttempt $attempt) use ($class) {
            $total = max(1, $this->resolveAttemptTotalMarks($attempt));
            $percentage = round((((float) ($attempt->score ?? 0)) / $total) * 100, 2);

            return [
                'student_id' => (int) $attempt->student_id,
                'student_name' => trim((string) (($attempt->student?->first_name ?? '') . ' ' . ($attempt->student?->last_name ?? ''))),
                'registration_number' => (string) ($attempt->student?->registration_number ?? '-'),
                'class_level' => (string) ($attempt->student?->class_level ?? $attempt->exam?->class_level ?? $class->name),
                'subject' => (string) ($attempt->exam?->subject?->name ?? 'Unknown'),
                'component' => $this->attemptComponent($attempt),
                'percentage' => $percentage,
                'weight' => is_numeric($attempt->exam?->assessment_weight) ? (float) $attempt->exam->assessment_weight : null,
                'exam_id' => (int) $attempt->exam_id,
            ];
        })->values();

        $rows = collect();
        $byStudent = $records->groupBy('student_id');

        foreach ($byStudent as $studentRecords) {
            $subjectRows = collect($studentRecords)
                ->groupBy('subject')
                ->map(function (Collection $subjectRecords, string $subject) use ($useAssessmentWeight, $defaultCaWeight, $defaultExamWeight) {
                    $caRecords = $subjectRecords->where('component', 'ca')->values();
                    $examRecords = $subjectRecords->where('component', 'exam')->values();

                    $caScore = $this->weightedAverage($caRecords, $useAssessmentWeight, $defaultCaWeight);
                    $examScore = $this->weightedAverage($examRecords, $useAssessmentWeight, $defaultExamWeight);

                    if ($caScore !== null && $examScore !== null) {
                        $denominator = max(1, $defaultCaWeight + $defaultExamWeight);
                        $compiled = round((($caScore * $defaultCaWeight) + ($examScore * $defaultExamWeight)) / $denominator, 2);
                    } elseif ($caScore !== null) {
                        $compiled = $caScore;
                    } else {
                        $compiled = $examScore;
                    }

                    return [
                        'subject' => $subject,
                        'ca_score' => $caScore,
                        'exam_score' => $examScore,
                        'compiled_score' => $compiled,
                        'source_exam_ids' => collect($subjectRecords)
                            ->pluck('exam_id')
                            ->map(fn ($id) => (int) $id)
                            ->filter(fn ($id) => $id > 0)
                            ->unique()
                            ->values()
                            ->all(),
                    ];
                })
                ->values();

            $cr = $subjectRows
                ->pluck('compiled_score')
                ->filter(fn ($score) => $score !== null)
                ->avg();

            $first = collect($studentRecords)->first();
            foreach ($subjectRows as $subjectRow) {
                $rows->push([
                    'student_name' => (string) ($first['student_name'] ?? 'Unknown'),
                    'registration_number' => (string) ($first['registration_number'] ?? '-'),
                    'class_level' => (string) ($first['class_level'] ?? '-'),
                    'term' => $term,
                    'subject' => (string) ($subjectRow['subject'] ?? 'Unknown'),
                    'ca_score' => $subjectRow['ca_score'] ?? null,
                    'exam_score' => $subjectRow['exam_score'] ?? null,
                    'compiled_score' => $subjectRow['compiled_score'] ?? null,
                    'cumulative_average' => $cr !== null ? round((float) $cr, 2) : null,
                    'source_exam_ids' => $subjectRow['source_exam_ids'] ?? [],
                ]);
            }
        }

        return $rows->sortBy([
            ['student_name', 'asc'],
            ['subject', 'asc'],
        ])->values();
    }

    private function attemptComponent(ExamAttempt $attempt): string
    {
        $mode = strtolower(trim((string) ($attempt->assessment_mode ?? '')));
        if ($mode === 'ca_test') {
            return 'ca';
        }
        if ($mode === 'exam') {
            return 'exam';
        }

        $assessmentType = strtolower(trim((string) ($attempt->exam?->assessment_type ?? '')));
        return $this->isContinuousAssessmentType($assessmentType) ? 'ca' : 'exam';
    }

    private function weightedAverage(Collection $records, bool $useAssessmentWeight, float $fallbackWeight): ?float
    {
        if ($records->isEmpty()) {
            return null;
        }

        $totalWeight = 0.0;
        $weightedTotal = 0.0;

        foreach ($records as $record) {
            $weight = $fallbackWeight;
            if ($useAssessmentWeight && is_numeric($record['weight'] ?? null)) {
                $candidate = (float) $record['weight'];
                if ($candidate > 0) {
                    $weight = $candidate;
                }
            }

            $totalWeight += $weight;
            $weightedTotal += ((float) ($record['percentage'] ?? 0)) * $weight;
        }

        if ($totalWeight <= 0) {
            return round((float) $records->avg('percentage'), 2);
        }

        return round($weightedTotal / $totalWeight, 2);
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

        if ($questionIds->isNotEmpty()) {
            $questions = Question::with('bankQuestion:id,marks')
                ->whereIn('id', $questionIds)
                ->get();

            $total = (float) $questions->sum(function (Question $question) {
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

            if ($total > 0) {
                return $total;
            }
        }

        $fromExam = (float) ($attempt->exam?->total_marks ?? data_get($attempt->exam?->metadata, 'total_marks') ?? 0);
        if ($fromExam > 0) {
            return $fromExam;
        }

        return 0.0;
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
            $passPercentage = SystemSetting::get('pass_mark_percentage', 50);
            $passPercentage = is_numeric($passPercentage) ? (float) $passPercentage : 50.0;
            return round($totalMarks * max(0.0, min(100.0, $passPercentage)) / 100, 2);
        }

        return null;
    }

    private function hasPassed(float $score, float $totalMarks, ?float $passingMarks): bool
    {
        if ($passingMarks !== null) {
            return $score >= $passingMarks;
        }

        if ($totalMarks <= 0) {
            return false;
        }

        $passPercentage = SystemSetting::get('pass_mark_percentage', 50);
        $passPercentage = is_numeric($passPercentage) ? (float) $passPercentage : 50.0;
        $percentage = ($score / max(1.0, $totalMarks)) * 100;

        return $percentage >= max(0.0, min(100.0, $passPercentage));
    }

    private function resolveAssessmentTypeLabel(ExamAttempt $attempt): string
    {
        $raw = trim((string) ($attempt->exam?->assessment_type ?? ''));
        if ($raw !== '') {
            return $raw;
        }

        return $this->attemptComponent($attempt) === 'ca' ? 'CA Test' : 'Final Exam';
    }

    private function isContinuousAssessmentType(string $assessmentType): bool
    {
        return in_array($assessmentType, [
            'ca',
            'ca test',
            'continuous assessment',
            'quiz',
            'midterm',
            'midterm test',
        ], true);
    }

    private function resolveExamTerm(Exam $exam): string
    {
        $term = trim((string) ($exam->term ?? data_get($exam->metadata, 'term') ?? ''));
        return in_array($term, ['First Term', 'Second Term', 'Third Term'], true)
            ? $term
            : (string) SystemSetting::get('current_term', 'First Term');
    }

    private function resolveExamSession(Exam $exam): string
    {
        $session = trim((string) ($exam->academic_session ?? data_get($exam->metadata, 'academic_session') ?? ''));
        if ($session !== '') {
            return $session;
        }

        return (string) SystemSetting::get('current_academic_session', $this->defaultAcademicSession());
    }

    private function defaultAcademicSession(): string
    {
        $year = (int) date('Y');
        return $year . '/' . ($year + 1);
    }

    private function normalizeTerm(string $term): string
    {
        $normalized = strtolower(trim(urldecode($term)));
        return match ($normalized) {
            'first term', 'first_term', 'first-term' => 'First Term',
            'second term', 'second_term', 'second-term' => 'Second Term',
            'third term', 'third_term', 'third-term' => 'Third Term',
            default => trim(urldecode($term)),
        };
    }

    private function normalizeSessionSlug(string $session): string
    {
        $decoded = trim(urldecode($session));
        if (preg_match('/^\d{4}-\d{4}$/', $decoded) === 1) {
            return str_replace('-', '/', $decoded);
        }

        return str_replace('_', '/', $decoded);
    }

    private function boundedSetting(string $key, float $default, float $min, float $max): float
    {
        $raw = SystemSetting::get($key, $default);
        $value = is_numeric($raw) ? (float) $raw : $default;
        return min($max, max($min, $value));
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
