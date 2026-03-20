<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class TermAggregateExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(private readonly Collection $rows)
    {
    }

    public function collection(): Collection
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return [
            'Student Name',
            'Registration Number',
            'Class Level',
            'Term',
            'Subject',
            'CA (%)',
            'Exam (%)',
            'Compiled (%)',
            'Source Exam IDs',
        ];
    }

    public function map($row): array
    {
        $source = is_array($row['source_exam_ids'] ?? null)
            ? collect($row['source_exam_ids'])->map(fn ($id) => '#' . (int) $id)->implode(', ')
            : '';

        return [
            (string) ($row['student_name'] ?? '-'),
            (string) ($row['registration_number'] ?? '-'),
            (string) ($row['class_level'] ?? '-'),
            (string) ($row['term'] ?? '-'),
            (string) ($row['subject'] ?? '-'),
            isset($row['ca_score']) && $row['ca_score'] !== null ? number_format((float) $row['ca_score'], 2) : '-',
            isset($row['exam_score']) && $row['exam_score'] !== null ? number_format((float) $row['exam_score'], 2) : '-',
            isset($row['compiled_score']) && $row['compiled_score'] !== null ? number_format((float) $row['compiled_score'], 2) : '-',
            $source !== '' ? $source : '-',
        ];
    }
}
