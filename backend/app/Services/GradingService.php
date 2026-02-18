<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Collection;

class GradingService
{
    private const DEFAULT_WAEC_SCALE = [
        ['grade' => 'A1', 'min' => 75],
        ['grade' => 'B2', 'min' => 70],
        ['grade' => 'B3', 'min' => 65],
        ['grade' => 'C4', 'min' => 60],
        ['grade' => 'C5', 'min' => 55],
        ['grade' => 'C6', 'min' => 50],
        ['grade' => 'D7', 'min' => 45],
        ['grade' => 'E8', 'min' => 40],
        ['grade' => 'F9', 'min' => 0],
    ];

    private const DEFAULT_LETTER_SCALE = [
        ['grade' => 'A', 'min' => 70],
        ['grade' => 'B', 'min' => 60],
        ['grade' => 'C', 'min' => 50],
        ['grade' => 'D', 'min' => 45],
        ['grade' => 'E', 'min' => 40],
        ['grade' => 'F', 'min' => 0],
    ];

    private const DEFAULT_POSITION_SCALE = [
        ['label' => '1st', 'min' => 70],
        ['label' => '2nd', 'min' => 60],
        ['label' => '3rd', 'min' => 50],
        ['label' => 'Pass', 'min' => 40],
        ['label' => 'Fail', 'min' => 0],
    ];

    public function gradeFromPercentage(?float $percentage): ?string
    {
        if ($percentage === null) {
            return null;
        }

        if ($this->currentScheme() === 'position') {
            return $this->positionBandFromPercentage($percentage);
        }

        $scale = $this->gradeScale();
        return $this->resolveLabelFromScale($percentage, $scale, 'grade');
    }

    public function gradeLabel(?float $percentage, ?int $rankPosition = null): ?string
    {
        if ($percentage === null) {
            return null;
        }

        if ($this->currentScheme() === 'position') {
            return $this->ordinalPosition($rankPosition);
        }

        $scale = $this->gradeScale();
        return $this->resolveLabelFromScale($percentage, $scale, 'grade');
    }

    public function positionBandFromPercentage(?float $percentage): ?string
    {
        if ($percentage === null) {
            return null;
        }

        $scale = $this->positionScale();
        return $this->resolveLabelFromScale($percentage, $scale, 'label');
    }

    public function positionLabel(?float $percentage, ?int $rankPosition = null): ?string
    {
        if ($this->currentScheme() === 'position') {
            return $this->ordinalPosition($rankPosition);
        }

        if ($percentage === null) {
            return null;
        }

        return $this->positionBandFromPercentage($percentage);
    }

    public function scheme(): string
    {
        return $this->currentScheme();
    }

    public function passMarkPercentage(): float
    {
        $value = SystemSetting::get('pass_mark_percentage', 50);
        $numeric = is_numeric($value) ? (float) $value : 50.0;
        return min(100, max(0, $numeric));
    }

    public function didPassPercentage(?float $percentage): bool
    {
        if ($percentage === null) {
            return false;
        }

        return $percentage >= $this->passMarkPercentage();
    }

    public function ordinalPosition(?int $position): ?string
    {
        if (!$position || $position < 1) {
            return null;
        }

        $value = (int) $position;
        $suffix = 'th';

        if (($value % 100) < 11 || ($value % 100) > 13) {
            $suffix = match ($value % 10) {
                1 => 'st',
                2 => 'nd',
                3 => 'rd',
                default => 'th',
            };
        }

        return $value . $suffix;
    }

    private function gradeScale(): Collection
    {
        $scheme = $this->currentScheme();

        if ($scheme === 'letter') {
            $rawScale = SystemSetting::get('grading_scale_letter', self::DEFAULT_LETTER_SCALE);
            $scale = $this->normalizeScale($rawScale, 'grade');
            return $scale->isNotEmpty() ? $scale : collect(self::DEFAULT_LETTER_SCALE);
        }

        // Default and recommended scheme.
        $rawScale = SystemSetting::get('grading_scale_waec', self::DEFAULT_WAEC_SCALE);
        $scale = $this->normalizeScale($rawScale, 'grade');
        return $scale->isNotEmpty() ? $scale : collect(self::DEFAULT_WAEC_SCALE);
    }

    private function currentScheme(): string
    {
        $scheme = strtolower(trim((string) SystemSetting::get('grading_scheme', 'waec')));
        return in_array($scheme, ['waec', 'letter', 'position'], true) ? $scheme : 'waec';
    }

    private function positionScale(): Collection
    {
        $rawScale = SystemSetting::get('position_grading_scale', self::DEFAULT_POSITION_SCALE);
        $scale = $this->normalizeScale($rawScale, 'label');
        return $scale->isNotEmpty() ? $scale : collect(self::DEFAULT_POSITION_SCALE);
    }

    private function normalizeScale(mixed $rawScale, string $labelKey): Collection
    {
        $scale = $this->decodeJsonIfNeeded($rawScale);

        if (is_array($scale) && $this->isAssoc($scale)) {
            $scale = collect($scale)
                ->map(fn ($min, $grade) => [$labelKey => (string) $grade, 'min' => $min])
                ->values()
                ->all();
        }

        if (!is_array($scale)) {
            return collect();
        }

        return collect($scale)
            ->map(function ($entry) use ($labelKey) {
                if (!is_array($entry)) {
                    return null;
                }

                $label = trim((string) ($entry[$labelKey] ?? ''));
                $min = $entry['min'] ?? null;

                if ($label === '' || !is_numeric($min)) {
                    return null;
                }

                return [
                    $labelKey => $label,
                    'min' => (float) $min,
                ];
            })
            ->filter()
            ->sortByDesc('min')
            ->values();
    }

    private function resolveLabelFromScale(float $percentage, Collection $scale, string $labelKey): ?string
    {
        foreach ($scale as $entry) {
            $min = (float) ($entry['min'] ?? 0);
            if ($percentage >= $min) {
                return (string) ($entry[$labelKey] ?? null);
            }
        }

        return null;
    }

    private function decodeJsonIfNeeded(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }

        return $value;
    }

    private function isAssoc(array $array): bool
    {
        return array_values($array) !== $array;
    }
}
