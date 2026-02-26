<?php

namespace App\Services;

use App\Models\Page;
use Illuminate\Support\Collection;
use Spatie\Permission\Models\Role;

class RolePermissionSyncService
{
    private const CORE_ADMIN_ROLES = [
        'Main Admin',
        'Admin',
        'Teacher',
    ];

    /**
     * Pages restricted to Main Admin only.
     */
    private const MAIN_ADMIN_ONLY_PAGES = [
        'System Settings',
        'Activity Logs',
        'Users',
        'Roles',
    ];

    /**
     * Default page access for predefined admin-side roles.
     */
    private const ROLE_PAGE_DEFAULTS = [
        'Sub-Admin' => [
            'Overview',
            'Questions',
            'Exams',
            'Exam Access',
            'Students',
            'Results & Marking',
            'Marking Workbench',
            'Academic Management',
            'Announcements',
            'Allocation System',
            'View Allocations',
            'Generate Allocation',
            'Teacher Assignment',
            'Halls',
        ],
        'Moderator' => [
            'Overview',
            'Exams',
            'Exam Access',
            'Students',
            'Results & Marking',
            'Marking Workbench',
        ],
        'Teacher' => [
            'Overview',
            'Questions',
            'Results & Marking',
            'Marking Workbench',
        ],
    ];

    public function listAdminAssignableRoles(): Collection
    {
        $this->ensureCoreAdminRolesExist();

        return Role::query()
            ->where('guard_name', 'web')
            ->whereRaw('LOWER(name) != ?', ['student'])
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    /**
     * Synchronize default page permissions for known admin roles.
     * Custom roles remain unchanged unless includeCustomRolesWithoutPagePerms=true.
     */
    public function syncDefaultPagePermissions(
        ?Collection $pages = null,
        bool $includeCustomRolesWithoutPagePerms = false
    ): void {
        $this->ensureCoreAdminRolesExist();

        $pages = $pages ?: Page::query()->where('is_active', true)->get();
        $pagesByName = $pages->keyBy('name');
        $allPagePermissions = $pages->pluck('permission_name')->filter()->values();

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->whereRaw('LOWER(name) != ?', ['student'])
            ->get();

        foreach ($roles as $role) {
            $roleName = (string) $role->name;
            $pagePermissions = $this->pagePermissionsForRole($roleName, $pagesByName, $allPagePermissions);

            if ($pagePermissions->isEmpty()) {
                if (!$includeCustomRolesWithoutPagePerms) {
                    continue;
                }

                // Keep non-page permissions only when explicitly syncing custom roles.
                $this->syncRolePagePermissions($role, collect());
                continue;
            }

            $this->syncRolePagePermissions($role, $pagePermissions);
        }
    }

    public function applyDefaultPermissionsForRole(Role $role, ?Collection $pages = null): void
    {
        if (strtolower((string) $role->name) === 'student') {
            return;
        }

        $pages = $pages ?: Page::query()->where('is_active', true)->get();
        $pagesByName = $pages->keyBy('name');
        $allPagePermissions = $pages->pluck('permission_name')->filter()->values();

        $defaultPagePermissions = $this->pagePermissionsForRole((string) $role->name, $pagesByName, $allPagePermissions);

        if ($defaultPagePermissions->isNotEmpty()) {
            $this->syncRolePagePermissions($role, $defaultPagePermissions);
        }
    }

    public function syncRolePagePermissions(Role $role, Collection $pagePermissions): void
    {
        $existingPermissions = $role->permissions()->pluck('name');
        $nonPagePermissions = $existingPermissions
            ->filter(fn ($name) => !str_starts_with((string) $name, 'access:'))
            ->values();

        $role->syncPermissions($nonPagePermissions->merge($pagePermissions->values())->unique()->values());
    }

    private function pagePermissionsForRole(string $roleName, Collection $pagesByName, Collection $allPagePermissions): Collection
    {
        if (strcasecmp($roleName, 'Main Admin') === 0) {
            return $allPagePermissions;
        }

        if (strcasecmp($roleName, 'Admin') === 0) {
            return $pagesByName
                ->reject(fn (Page $page) => in_array($page->name, self::MAIN_ADMIN_ONLY_PAGES, true))
                ->pluck('permission_name')
                ->filter()
                ->values();
        }

        $defaultRoleKey = collect(array_keys(self::ROLE_PAGE_DEFAULTS))
            ->first(fn (string $definedRoleName) => strcasecmp($definedRoleName, $roleName) === 0);

        $defaultPageNames = $defaultRoleKey ? (self::ROLE_PAGE_DEFAULTS[$defaultRoleKey] ?? null) : null;
        if (!$defaultPageNames) {
            return collect();
        }

        return collect($defaultPageNames)
            ->map(fn (string $pageName) => $pagesByName->get($pageName)?->permission_name)
            ->filter()
            ->values();
    }

    private function ensureCoreAdminRolesExist(): void
    {
        foreach (self::CORE_ADMIN_ROLES as $roleName) {
            Role::query()->firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web']
            );
        }
    }
}
