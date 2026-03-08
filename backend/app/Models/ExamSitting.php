<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class ExamSitting extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'session',
        'term',
        'assessment_mode_snapshot',
        'question_count',
        'duration_minutes',
        'start_at',
        'end_at',
        'status',
        'results_released',
        'title_override',
        'instructions_override',
        'created_by',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'results_released' => 'boolean',
        'question_count' => 'integer',
        'duration_minutes' => 'integer',
        'created_by' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class, 'exam_sitting_id');
    }

    public static function resolveForExam(Exam $exam): ?self
    {
        if (!Schema::hasTable('exam_sittings')) {
            return null;
        }

        $now = now();

        $active = self::query()
            ->where('exam_id', $exam->id)
            ->whereIn('status', ['active', 'scheduled'])
            ->where(function ($q) use ($now) {
                $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
            })
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END")
            ->orderByDesc('id')
            ->first();

        if ($active) {
            return $active;
        }

        $fallback = self::query()
            ->where('exam_id', $exam->id)
            ->orderByRaw("CASE status WHEN 'scheduled' THEN 0 WHEN 'draft' THEN 1 WHEN 'active' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->first();

        return $fallback;
    }

    public static function resolveOrCreateDefault(Exam $exam, ?string $fallbackMode = null): self
    {
        if (!Schema::hasTable('exam_sittings')) {
            return new self(self::templateAttributes($exam, $fallbackMode));
        }

        $existing = self::resolveForExam($exam);
        if ($existing) {
            return $existing;
        }

        return self::createFromExamTemplate($exam, $fallbackMode);
    }

    public static function createFromExamTemplate(Exam $exam, ?string $fallbackMode = null): self
    {
        $attributes = self::templateAttributes($exam, $fallbackMode);

        if (!Schema::hasTable('exam_sittings')) {
            return new self($attributes);
        }

        return self::create($attributes);
    }

    private static function templateAttributes(Exam $exam, ?string $fallbackMode = null): array
    {
        $mode = $fallbackMode;
        if (!in_array($mode, ['ca_test', 'exam'], true)) {
            $assessmentType = strtolower(trim((string) ($exam->assessment_type ?? '')));
            $mode = $assessmentType === 'ca test' ? 'ca_test' : 'exam';
        }

        $status = match ((string) ($exam->status ?? 'draft')) {
            'active' => 'active',
            'scheduled' => 'scheduled',
            'completed', 'cancelled' => 'closed',
            default => 'draft',
        };

        $questionCount = (int) ($exam->metadata['question_count'] ?? 0);
        if ($questionCount <= 0) {
            $questionCount = null;
        }

        return [
            'exam_id' => (int) $exam->id,
            'session' => $exam->academic_session,
            'term' => $exam->term,
            'assessment_mode_snapshot' => $mode,
            'question_count' => $questionCount,
            'duration_minutes' => (int) ($exam->duration_minutes ?? 0) > 0 ? (int) $exam->duration_minutes : null,
            'start_at' => $exam->start_datetime ?? $exam->start_time,
            'end_at' => $exam->end_datetime ?? $exam->end_time,
            'status' => $status,
            'results_released' => (bool) ($exam->results_released ?? false),
            'title_override' => null,
            'instructions_override' => null,
            'created_by' => null,
        ];
    }
}
