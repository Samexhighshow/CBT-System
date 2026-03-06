<?php

namespace App\Exports;

use App\Models\ExamAttempt;
use App\Models\Question;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ExamResultsExport implements FromCollection, WithHeadings, WithMapping
{
    protected $examId;

    public function __construct($examId)
    {
        $this->examId = $examId;
    }

    public function collection()
    {
        return ExamAttempt::with(['student.department', 'exam'])
            ->where('exam_id', $this->examId)
            ->where('status', 'completed')
            ->orderBy('score', 'desc')
            ->get();
    }

    public function headings(): array
    {
        return [
            'Registration Number',
            'Student Name',
            'Department',
            'Class Level',
            'Score',
            'Total Marks',
            'Percentage',
            'Status',
            'Completed At',
            'Duration (minutes)',
        ];
    }

    public function map($attempt): array
    {
        $score = (float) ($attempt->score ?? 0);
        $totalMarks = $this->resolveAttemptTotalMarks($attempt);
        $safeTotal = max(1.0, $totalMarks);
        $percentage = round(($score / $safeTotal) * 100, 2);
        $passingMarks = $this->resolveAttemptPassingMarks($attempt, $totalMarks);
        $passed = $this->hasPassed($score, $totalMarks, $passingMarks);
        $duration = ($attempt->started_at && $attempt->completed_at)
            ? $attempt->started_at->diffInMinutes($attempt->completed_at)
            : null;

        return [
            $attempt->student->registration_number,
            $attempt->student->first_name . ' ' . $attempt->student->last_name,
            $attempt->student->department->name ?? 'N/A',
            $attempt->student->class_level,
            $score,
            $totalMarks,
            $percentage . '%',
            $passed ? 'Passed' : 'Failed',
            $attempt->completed_at?->format('Y-m-d H:i:s') ?? '-',
            $duration,
        ];
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

        $fromExam = (float) ($attempt->exam->total_marks ?? data_get($attempt->exam->metadata, 'total_marks') ?? 0);
        return $fromExam > 0 ? $fromExam : 0.0;
    }

    private function resolveAttemptPassingMarks(ExamAttempt $attempt, ?float $totalMarks = null): ?float
    {
        $direct = $attempt->exam->passing_marks ?? null;
        if ($direct !== null && is_numeric($direct)) {
            return (float) $direct;
        }

        $metaPassing = data_get($attempt->exam->metadata, 'passing_marks');
        if ($metaPassing !== null && is_numeric($metaPassing)) {
            return (float) $metaPassing;
        }

        if ($totalMarks !== null && $totalMarks > 0) {
            return round($totalMarks * 0.5, 2);
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

        return (($score / max(1.0, $totalMarks)) * 100) >= 50;
    }
}
