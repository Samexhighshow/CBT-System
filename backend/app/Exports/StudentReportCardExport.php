<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class StudentReportCardExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly array $subjects,
        private readonly array $row
    ) {
    }

    public function headings(): array
    {
        return array_merge(
            ['Student Name', 'Registration Number', 'Class Level'],
            $this->subjects,
            ['Average (%)', 'Position', 'Grade', 'Passed Subjects', 'Pass Rate (%)', 'Remarks', 'Teacher Remark', 'Principal Remark']
        );
    }

    public function collection(): Collection
    {
        $line = [
            (string) ($this->row['student_name'] ?? '-'),
            (string) ($this->row['registration_number'] ?? '-'),
            (string) ($this->row['class_level'] ?? '-'),
        ];

        foreach ($this->subjects as $subject) {
            $score = data_get($this->row, 'subject_scores.' . $subject);
            $line[] = $score !== null ? number_format((float) $score, 2) : '-';
        }

        $line[] = isset($this->row['average_score']) && $this->row['average_score'] !== null ? number_format((float) $this->row['average_score'], 2) : '-';
        $line[] = $this->row['position'] ?? '-';
        $line[] = (string) ($this->row['overall_grade'] ?? '-');
        $line[] = (string) (($this->row['passed_subjects'] ?? 0) . '/' . ($this->row['total_subjects'] ?? 0));
        $line[] = isset($this->row['pass_rate']) && $this->row['pass_rate'] !== null ? number_format((float) $this->row['pass_rate'], 1) : '-';
        $line[] = (string) ($this->row['remarks'] ?? '-');
        $line[] = (string) ($this->row['teacher_remark'] ?? '-');
        $line[] = (string) ($this->row['principal_remark'] ?? '-');

        return collect([$line]);
    }
}
