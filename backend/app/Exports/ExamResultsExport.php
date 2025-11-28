<?php

namespace App\Exports;

use App\Models\ExamAttempt;
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
        $percentage = round(($attempt->score / $attempt->exam->total_marks) * 100, 2);
        $passed = $attempt->score >= $attempt->exam->passing_marks;
        $duration = $attempt->started_at->diffInMinutes($attempt->completed_at);

        return [
            $attempt->student->registration_number,
            $attempt->student->first_name . ' ' . $attempt->student->last_name,
            $attempt->student->department->name ?? 'N/A',
            $attempt->student->class_level,
            $attempt->score,
            $attempt->exam->total_marks,
            $percentage . '%',
            $passed ? 'Passed' : 'Failed',
            $attempt->completed_at->format('Y-m-d H:i:s'),
            $duration,
        ];
    }
}
