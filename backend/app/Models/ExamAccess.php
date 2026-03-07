<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExamAccess extends Model
{
    use HasFactory;

    protected $table = 'exam_access';

    protected $fillable = [
        'client_code_id',
        'exam_id',
        'student_id',
        'student_reg_number',
        'access_code',
        'status',
        'active_new_token',
        'used',
        'used_at',
        'used_by_device_id',
        'attempt_uuid',
        'expires_at',
    ];

    protected $casts = [
        'used' => 'boolean',
        'active_new_token' => 'integer',
        'used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $model) {
            $status = strtoupper((string) ($model->status ?? 'NEW'));
            $isUsed = (bool) ($model->used ?? false);

            // Keep guard token aligned with the active NEW state.
            $model->active_new_token = ($status === 'NEW' && !$isUsed && !empty($model->student_id)) ? 1 : null;
        });
    }

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
        return $this->belongsTo(Student::class, 'student_id');
    }

    /**
     * Check if the access code is valid
     */
    public function isValid(): bool
    {
        return !$this->used &&
               strtoupper((string) $this->status) !== 'VOID' &&
               ($this->expires_at === null || $this->expires_at->isFuture());
    }

    /**
     * Mark the access code as used
     */
    public function markAsUsed(): void
    {
        $this->update([
            'status' => 'USED',
            'active_new_token' => null,
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
