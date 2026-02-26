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
            ->map(fn ($name) => strtolower(trim((string) $name)))
            ->unique()
            ->values()
            ->all();
    }

    public function applySubjectScope(Builder $query, ?User $user, string $subjectIdColumn = 'id', ?string $classIdColumn = 'class_id', ?string $classLevelColumn = 'class_level'): Builder
    {
        if (!$this->isScopedActor($user)) {
            return $query;
        }

        $subjectIds = $this->scopedSubjectIds($user);
        $classIds = $this->scopedClassIds($user);
        $classLevels = $this->scopedClassLevels($user);

        if (empty($subjectIds) && empty($classIds) && empty($classLevels)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($q) use ($subjectIdColumn, $classIdColumn, $classLevelColumn, $subjectIds, $classIds, $classLevels) {
            if (!empty($subjectIds)) {
                $q->orWhereIn($subjectIdColumn, $subjectIds);
            }

            if ($classIdColumn && !empty($classIds)) {
                $q->orWhereIn($classIdColumn, $classIds);
            }

            if ($classLevelColumn && !empty($classLevels)) {
                $q->orWhereIn($classLevelColumn, $classLevels);
                $q->orWhereIn($classLevelColumn, array_map('strtoupper', $classLevels));
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

        $examIds = $this->scopedExamIds($user);
        $subjectIds = $this->scopedSubjectIds($user);
        $classIds = $this->scopedClassIds($user);
        $classLevels = $this->scopedClassLevels($user);

        if ($examId && in_array($examId, $examIds, true)) {
            return true;
        }
        if ($subjectId && in_array($subjectId, $subjectIds, true)) {
            return true;
        }
        if ($classId && in_array($classId, $classIds, true)) {
            return true;
        }
        if ($classLevel && in_array(strtolower(trim($classLevel)), $classLevels, true)) {
            return true;
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
}
