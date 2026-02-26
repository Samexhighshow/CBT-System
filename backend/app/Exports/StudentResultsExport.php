<?php

namespace App\Exports;

use App\Models\ExamAttempt;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StudentResultsExport implements FromCollection, WithHeadings, WithMapping
{
    protected $studentId;
    protected $releasedOnly;

    public function __construct($studentId, bool $releasedOnly = false)
    {
        $this->studentId = $studentId;
        $this->releasedOnly = $releasedOnly;
    }

    public function collection()
    {
        $query = ExamAttempt::with(['exam.subject'])
            ->where('student_id', $this->studentId)
            ->whereIn('status', ['completed', 'submitted'])
            ->orderBy('completed_at', 'desc');

        if ($this->releasedOnly) {
            $query->whereHas('exam', function ($q) {
                $q->where('results_released', true);
            });
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'Exam Title',
            'Subject',
            'Score',
            'Total Marks',
            'Percentage',
            'Passing Marks',
            'Status',
            'Completed At',
            'Duration (minutes)',
        ];
    }

    public function map($attempt): array
    {
        $percentage = round(($attempt->score / $attempt->exam->total_marks) * 100, 2);
        $passed = $attempt->score >= $attempt->exam->passing_marks;
        $duration = $attempt->started_at->diffInMinutes($attempt->completed_at);

        return [
            $attempt->exam->title,
            $attempt->exam->subject->name,
            $attempt->score,
            $attempt->exam->total_marks,
            $percentage . '%',
            $attempt->exam->passing_marks,
            $passed ? 'Passed' : 'Failed',
            $attempt->completed_at->format('Y-m-d H:i:s'),
            $duration,
        ];
    }
}
