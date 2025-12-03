<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AllocationRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'created_by',
        'shuffle_seed',
        'mode',
        'seat_numbering',
        'adjacency_strictness',
        'metadata',
        'notes',
        'completed_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'completed_at' => 'datetime',
    ];

    /**
     * Get the exam this run is for
     */
    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    /**
     * Get the user who created this allocation
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all allocations in this run
     */
    public function allocations()
    {
        return $this->hasMany(Allocation::class);
    }

    /**
     * Mark run as completed
     */
    public function markCompleted()
    {
        $this->update(['completed_at' => now()]);
    }

    /**
     * Check if run is completed
     */
    public function isCompleted()
    {
        return !is_null($this->completed_at);
    }
}
