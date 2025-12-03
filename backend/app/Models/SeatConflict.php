<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SeatConflict extends Model
{
    use HasFactory;

    protected $fillable = [
        'allocation_id',
        'conflicting_allocation_id',
        'type',
        'details',
        'resolved',
    ];

    protected $casts = [
        'details' => 'array',
        'resolved' => 'boolean',
    ];

    /**
     * Get the primary allocation
     */
    public function allocation()
    {
        return $this->belongsTo(Allocation::class);
    }

    /**
     * Get the conflicting allocation
     */
    public function conflictingAllocation()
    {
        return $this->belongsTo(Allocation::class, 'conflicting_allocation_id');
    }

    /**
     * Mark conflict as resolved
     */
    public function resolve()
    {
        $this->update(['resolved' => true]);
    }

    /**
     * Scope unresolved conflicts
     */
    public function scopeUnresolved($query)
    {
        return $query->where('resolved', false);
    }
}
