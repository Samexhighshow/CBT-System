<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class ClassReportCardsExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly array $subjects,
        private readonly Collection $rows
    ) {
    }

    public function headings(): array
    {
        return array_merge(
            ['Student Name', 'Registration Number', 'Class Level'],
            $this->subjects,
            ['Average (%)', 'Position', 'Grade', 'Passed Subjects', 'Pass Rate (%)', 'Remarks']
        );
    }

    public function collection(): Collection
    {
        return $this->rows->map(function (array $row) {
            $line = [
                (string) ($row['student_name'] ?? '-'),
                (string) ($row['registration_number'] ?? '-'),
                (string) ($row['class_level'] ?? '-'),
            ];

            foreach ($this->subjects as $subject) {
                $score = data_get($row, 'subject_scores.' . $subject);
                $line[] = $score !== null ? number_format((float) $score, 2) : '-';
            }

            $line[] = isset($row['average_score']) && $row['average_score'] !== null ? number_format((float) $row['average_score'], 2) : '-';
            $line[] = $row['position'] ?? '-';
            $line[] = (string) ($row['overall_grade'] ?? '-');
            $line[] = (string) (($row['passed_subjects'] ?? 0) . '/' . ($row['total_subjects'] ?? 0));
            $line[] = isset($row['pass_rate']) && $row['pass_rate'] !== null ? number_format((float) $row['pass_rate'], 1) : '-';
            $line[] = (string) ($row['remarks'] ?? '-');

            return $line;
        });
    }
}
