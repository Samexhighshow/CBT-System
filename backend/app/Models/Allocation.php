<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Allocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'allocation_run_id',
        'exam_id',
        'hall_id',
        'student_id',
        'row',
        'column',
        'seat_number',
        'class_level',
    ];

    protected $casts = [
        'row' => 'integer',
        'column' => 'integer',
        'seat_number' => 'integer',
    ];

    /**
     * Get the allocation run
     */
    public function allocationRun()
    {
        return $this->belongsTo(AllocationRun::class);
    }

    /**
     * Get the exam
     */
    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    /**
     * Get the hall
     */
    public function hall()
    {
        return $this->belongsTo(Hall::class);
    }

    /**
     * Get the student
     */
    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get conflicts for this allocation
     */
    public function conflicts()
    {
        return $this->hasMany(SeatConflict::class);
    }

    /**
     * Get adjacent positions (side, front, back)
     */
    public function getAdjacentPositions()
    {
        return [
            ['row' => $this->row, 'column' => $this->column - 1], // Left
            ['row' => $this->row, 'column' => $this->column + 1], // Right
            ['row' => $this->row - 1, 'column' => $this->column], // Front
            ['row' => $this->row + 1, 'column' => $this->column], // Back
        ];
    }

    /**
     * Get diagonal positions
     */
    public function getDiagonalPositions()
    {
        return [
            ['row' => $this->row - 1, 'column' => $this->column - 1],
            ['row' => $this->row - 1, 'column' => $this->column + 1],
            ['row' => $this->row + 1, 'column' => $this->column - 1],
            ['row' => $this->row + 1, 'column' => $this->column + 1],
        ];
    }
}
