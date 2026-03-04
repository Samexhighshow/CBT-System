<?php

namespace App\Services;

use App\Models\BankQuestion;
use App\Models\Exam;
use App\Models\RoleScope;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class RoleScopeService
{
    private function normalizeClassLevel(?string $value): string
    {
        return strtolower(str_replace(' ', '', trim((string) $value)));
    }

    private function classLevelVariants(array $levels): array
    {
        $variants = [];
        foreach ($levels as $level) {
            $raw = trim((string) $level);
            if ($raw === '') {
                continue;
            }

            $compact = str_replace(' ', '', $raw);
            $variants[] = $raw;
            $variants[] = strtolower($raw);
            $variants[] = strtoupper($raw);
            $variants[] = $compact;
            $variants[] = strtolower($compact);
            $variants[] = strtoupper($compact);
        }

        return collect($variants)->filter()->unique()->values()->all();
    }

    private function matchesScopeRow(
        RoleScope $scope,
        ?int $subjectId,
        ?string $classLevel,
        ?int $classId,
        ?int $examId,
        array $classNameById
    ): bool {
        if (!is_null($scope->exam_id)) {
            if (is_null($examId) || (int) $scope->exam_id !== (int) $examId) {
                return false;
            }
        }

        if (!is_null($scope->subject_id)) {
            if (is_null($subjectId) || (int) $scope->subject_id !== (int) $subjectId) {
                return false;
            }
        }

        if (!is_null($scope->class_id)) {
            $scopeClassId = (int) $scope->class_id;
            if (!is_null($classId)) {
                if ($scopeClassId !== (int) $classId) {
                    return false;
                }
            } else {
                $scopeClassName = (string) ($classNameById[$scopeClassId] ?? '');
                if ($scopeClassName === '' || is_null($classLevel)) {
                    return false;
                }

                if ($this->normalizeClassLevel($scopeClassName) !== $this->normalizeClassLevel($classLevel)) {
                    return false;
                }
            }
        }

        return true;
    }

    public function isAdminBypass(?User $user): bool
    {
        if (!$user) {
            return true;
        }

        return $user->hasAnyRole(['Main Admin', 'Admin']);
    }

    public function isScopedActor(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if ($this->isAdminBypass($user)) {
            return false;
        }

        return !$user->hasRole('Student');
    }

    public function roleNames(?User $user): array
    {
        if (!$user) {
            return [];
        }

        return collect($user->roles ?? [])
            ->map(fn ($role) => strtolower(trim((string) ($role->name ?? $role))))
            ->filter()
            ->values()
            ->all();
    }

    public function activeScopesForUser(User $user): Collection
    {
        $roleNames = $this->roleNames($user);

        return RoleScope::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->where('status', 'approved')
            ->where(function ($q) use ($roleNames) {
                $q->whereNull('role_name');
                if (!empty($roleNames)) {
                    $q->orWhereIn('role_name', $roleNames);
                }
            })
            ->get();
    }

    public function hasApprovedScopesForRole(User $user, string $roleName = 'teacher'): bool
    {
        if ($this->isAdminBypass($user)) {
            return true;
        }

        return RoleScope::query()
            ->where('user_id', $user->id)
            ->where('role_name', strtolower(trim($roleName)))
            ->where('is_active', true)
            ->where('status', 'approved')
            ->exists();
    }

    public function scopedSubjectIds(User $user): array
    {
        return $this->activeScopesForUser($user)
            ->pluck('subject_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    public function scopedClassIds(User $user): array
    {
        return $this->activeScopesForUser($user)
            ->pluck('class_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    public function scopedExamIds(User $user): array
    {
        return $this->activeScopesForUser($user)
            ->pluck('exam_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    public function scopedClassLevels(User $user): array
    {
        $classIds = $this->scopedClassIds($user);
        if (empty($classIds)) {
            return [];
        }

        return SchoolClass::query()
            ->whereIn('id', $classIds)
            ->pluck('name')
            ->filter()
            ->map(fn ($name) => trim((string) $name))
            ->unique()
            ->values()
            ->all();
    }

    public function applySubjectScope(Builder $query, ?User $user, string $subjectIdColumn = 'id', ?string $classIdColumn = 'class_id', ?string $classLevelColumn = 'class_level'): Builder
    {
        if (!$this->isScopedActor($user)) {
            return $query;
        }

        $scopes = $this->activeScopesForUser($user);
        if ($scopes->isEmpty()) {
            return $query->whereRaw('1 = 0');
        }

        $classNameById = [];
        $scopeClassIds = $scopes->pluck('class_id')->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        if (!empty($scopeClassIds)) {
            $classNameById = SchoolClass::query()
                ->whereIn('id', $scopeClassIds)
                ->pluck('name', 'id')
                ->map(fn ($name) => (string) $name)
                ->toArray();
        }

        return $query->where(function ($outer) use ($scopes, $subjectIdColumn, $classIdColumn, $classLevelColumn, $classNameById) {
            foreach ($scopes as $scope) {
                $outer->orWhere(function ($inner) use ($scope, $subjectIdColumn, $classIdColumn, $classLevelColumn, $classNameById) {
                    $hasConstraint = false;

                    if (!is_null($scope->subject_id)) {
                        $inner->where($subjectIdColumn, (int) $scope->subject_id);
                        $hasConstraint = true;
                    }

                    if (!is_null($scope->class_id)) {
                        $scopeClassId = (int) $scope->class_id;

                        $scopeClassName = (string) ($classNameById[$scopeClassId] ?? '');

                        if ($classIdColumn && $classLevelColumn && $scopeClassName !== '') {
                            $inner->where(function ($classMatch) use ($classIdColumn, $classLevelColumn, $scopeClassId, $scopeClassName) {
                                $classMatch->where($classIdColumn, $scopeClassId)
                                    ->orWhereRaw(
                                        'REPLACE(LOWER(' . $classLevelColumn . '), " ", "") = ?',
                                        [$this->normalizeClassLevel($scopeClassName)]
                                    );
                            });
                            $hasConstraint = true;
                        } elseif ($classIdColumn) {
                            $inner->where($classIdColumn, $scopeClassId);
                            $hasConstraint = true;
                        } elseif ($classLevelColumn) {
                            if ($scopeClassName !== '') {
                                $inner->whereRaw(
                                    'REPLACE(LOWER(' . $classLevelColumn . '), " ", "") = ?',
                                    [$this->normalizeClassLevel($scopeClassName)]
                                );
                                $hasConstraint = true;
                            } else {
                                $inner->whereRaw('1 = 0');
                                return;
                            }
                        }
                    }

                    if (!$hasConstraint) {
                        $inner->whereRaw('1 = 0');
                    }
                });
            }
        });
    }

    public function applyExamScope(Builder $query, ?User $user, string $examIdColumn = 'id', string $subjectIdColumn = 'subject_id', ?string $classIdColumn = 'class_id'): Builder
    {
        if (!$this->isScopedActor($user)) {
            return $query;
        }

        $examIds = $this->scopedExamIds($user);
        $subjectIds = $this->scopedSubjectIds($user);
        $classIds = $this->scopedClassIds($user);

        if (empty($examIds) && empty($subjectIds) && empty($classIds)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($q) use ($examIdColumn, $subjectIdColumn, $classIdColumn, $examIds, $subjectIds, $classIds) {
            if (!empty($examIds)) {
                $q->orWhereIn($examIdColumn, $examIds);
            }
            if (!empty($subjectIds)) {
                $q->orWhereIn($subjectIdColumn, $subjectIds);
            }
            if ($classIdColumn && !empty($classIds)) {
                $q->orWhereIn($classIdColumn, $classIds);
            }
        });
    }

    public function canAccessSubjectClass(?User $user, ?int $subjectId = null, ?string $classLevel = null, ?int $classId = null, ?int $examId = null): bool
    {
        if (!$this->isScopedActor($user)) {
            return true;
        }

        $scopes = $this->activeScopesForUser($user);
        if ($scopes->isEmpty()) {
            return false;
        }

        $classNameById = [];
        $scopeClassIds = $scopes->pluck('class_id')->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        if (!empty($scopeClassIds)) {
            $classNameById = SchoolClass::query()
                ->whereIn('id', $scopeClassIds)
                ->pluck('name', 'id')
                ->map(fn ($name) => (string) $name)
                ->toArray();
        }

        foreach ($scopes as $scope) {
            if ($this->matchesScopeRow($scope, $subjectId, $classLevel, $classId, $examId, $classNameById)) {
                return true;
            }
        }

        return false;
    }

    public function canManageExam(?User $user, Exam $exam): bool
    {
        return $this->canAccessSubjectClass(
            $user,
            (int) ($exam->subject_id ?? 0),
            (string) ($exam->class_level ?? ''),
            (int) ($exam->class_id ?? 0),
            (int) ($exam->id ?? 0)
        );
    }

    public function canManageSubject(?User $user, Subject $subject): bool
    {
        return $this->canAccessSubjectClass(
            $user,
            (int) ($subject->id ?? 0),
            (string) ($subject->class_level ?? ''),
            (int) ($subject->class_id ?? 0)
        );
    }

    public function canManageBankQuestion(?User $user, BankQuestion $question): bool
    {
        return $this->canAccessSubjectClass(
            $user,
            (int) ($question->subject_id ?? 0),
            (string) ($question->class_level ?? '')
        );
    }

    public function applyClassScope(Builder $query, ?User $user, string $classIdColumn = 'id', string $classLevelColumn = 'name'): Builder
    {
        if (!$this->isScopedActor($user)) {
            return $query;
        }

        $classIds = $this->scopedClassIds($user);
        $classLevels = $this->scopedClassLevels($user);

        if (empty($classIds) && empty($classLevels)) {
            return $query->whereRaw('1 = 0');
        }

        $classLevelVariants = $this->classLevelVariants($classLevels);

        return $query->where(function ($q) use ($classIdColumn, $classLevelColumn, $classIds, $classLevelVariants) {
            if (!empty($classIds)) {
                $q->orWhereIn($classIdColumn, $classIds);
            }

            if (!empty($classLevelVariants)) {
                $q->orWhereIn($classLevelColumn, $classLevelVariants);
            }
        });
    }

    public function canManageClass(?User $user, SchoolClass $class): bool
    {
        return $this->canAccessSubjectClass(
            $user,
            null,
            (string) ($class->name ?? ''),
            (int) ($class->id ?? 0)
        );
    }
}
