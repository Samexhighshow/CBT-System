<?php

namespace App\Exports;

use App\Models\AllocationRun;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class AllocationExport implements WithMultipleSheets
{
    protected $allocationRunId;

    public function __construct($allocationRunId)
    {
        $this->allocationRunId = $allocationRunId;
    }

    public function sheets(): array
    {
        $run = AllocationRun::with('allocations.hall')->findOrFail($this->allocationRunId);
        
        $sheets = [];
        
        // Group allocations by hall
        $hallGroups = $run->allocations->groupBy('hall_id');
        
        foreach ($hallGroups as $hallId => $allocations) {
            $hall = $allocations->first()->hall;
            $sheets[] = new AllocationHallSheet($allocations, $hall->name);
        }
        
        return $sheets;
    }
}

class AllocationHallSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    protected $allocations;
    protected $hallName;

    public function __construct($allocations, $hallName)
    {
        $this->allocations = $allocations;
        $this->hallName = $hallName;
    }

    public function collection()
    {
        return $this->allocations;
    }

    public function headings(): array
    {
        return [
            'Seat Number',
            'Row',
            'Column',
            'Student ID',
            'Student Name',
            'Class Level',
            'Registration Number',
        ];
    }

    public function map($allocation): array
    {
        return [
            $allocation->seat_number,
            $allocation->row,
            $allocation->column,
            $allocation->student->id,
            $allocation->student->name ?? $allocation->student->user->name,
            $allocation->class_level,
            $allocation->student->registration_number ?? 'N/A',
        ];
    }

    public function title(): string
    {
        return substr($this->hallName, 0, 31); // Excel sheet name limit
    }
}
