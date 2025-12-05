<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Hall extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'rows',
        'columns',
        'teachers_needed',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'rows' => 'integer',
        'columns' => 'integer',
        'teachers_needed' => 'integer',
        'is_active' => 'boolean',
    ];

    protected $appends = ['capacity'];

    /**
     * Get computed capacity (rows * columns)
     */
    public function getCapacityAttribute()
    {
        return $this->rows * $this->columns;
    }

    /**
     * Get teachers assigned to this hall
     */
    public function hallTeachers()
    {
        return $this->hasMany(HallTeacher::class);
    }

    /**
     * Get allocations in this hall
     */
    public function allocations()
    {
        return $this->hasMany(Allocation::class);
    }

    /**
     * Scope to get only active halls
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get grid layout for a specific exam allocation
     */
    public function getGridLayout($allocationRunId = null)
    {
        $grid = [];
        
        for ($r = 1; $r <= $this->rows; $r++) {
            for ($c = 1; $c <= $this->columns; $c++) {
                $grid[$r][$c] = [
                    'row' => $r,
                    'column' => $c,
                    'seat_number' => $this->computeSeatNumber($r, $c),
                    'student' => null,
                ];
            }
        }

        if ($allocationRunId) {
            $allocations = $this->allocations()
                ->where('allocation_run_id', $allocationRunId)
                ->with('student')
                ->get();

            foreach ($allocations as $allocation) {
                if (isset($grid[$allocation->row][$allocation->column])) {
                    $grid[$allocation->row][$allocation->column]['student'] = $allocation->student;
                    $grid[$allocation->row][$allocation->column]['allocation_id'] = $allocation->id;
                }
            }
        }

        return $grid;
    }

    /**
     * Compute seat number from row/column
     * Default: row-major numbering
     */
    public function computeSeatNumber($row, $column, $numbering = 'row_major')
    {
        if ($numbering === 'column_major') {
            return ($column - 1) * $this->rows + $row;
        }
        
        // row_major (default)
        return ($row - 1) * $this->columns + $column;
    }
}
