<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamAccess extends Model
{
    use HasFactory;

    protected $table = 'exam_access';

    protected $fillable = [
        'exam_id',
        'student_id',
        'access_code',
        'used',
        'used_at',
        'expires_at',
    ];

    protected $casts = [
        'used' => 'boolean',
        'used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    /**
     * Get the exam associated with this access code
     */
    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    /**
     * Get the student associated with this access code
     */
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Check if the access code is valid
     */
    public function isValid(): bool
    {
        return !$this->used && 
               ($this->expires_at === null || $this->expires_at->isFuture());
    }

    /**
     * Mark the access code as used
     */
    public function markAsUsed(): void
    {
        $this->update([
            'used' => true,
            'used_at' => now(),
        ]);
    }

    /**
     * Generate a unique access code
     */
    public static function generateUniqueCode(): string
    {
        do {
            // Generate 8-character alphanumeric code
            $code = strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));
        } while (self::where('access_code', $code)->exists());

        return $code;
    }
}
