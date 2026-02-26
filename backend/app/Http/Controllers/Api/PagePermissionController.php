<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Page;
use App\Services\RolePermissionSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PagePermissionController extends Controller
{
    public function __construct(
        private readonly RolePermissionSyncService $rolePermissionSyncService
    ) {
    }

    public function index()
    {
        $pages = Page::orderBy('category')->orderBy('name')->get();
        $roles = $this->rolePermissionSyncService->listAdminAssignableRoles();
        $rolePageMap = $this->buildRolePageMap($roles, $pages);

        $pagesWithRoles = $pages->map(function (Page $page) use ($roles, $rolePageMap) {
            $pageId = (int) $page->id;
            $roleMatches = [];

            foreach ($roles as $role) {
                $roleId = (int) $role->id;
                $pageIds = $rolePageMap[$roleId] ?? [];

                if (in_array($pageId, $pageIds, true)) {
                    $roleMatches[] = ['id' => $roleId, 'name' => $role->name];
                }
            }

            return array_merge($page->toArray(), ['roles' => collect($roleMatches)->values()]);
        });

        return response()->json([
            'pages' => $pagesWithRoles,
            'roles' => $roles->values(),
        ]);
    }

    public function rolePageMap()
    {
        $roles = $this->rolePermissionSyncService->listAdminAssignableRoles()
            ->sortBy('id')
            ->values();
        $pages = Page::query()->where('is_active', true)->get();
        $rolePageMap = $this->buildRolePageMap($roles, $pages);

        $map = $roles->map(function (Role $role) use ($pages, $rolePageMap) {
            $pageIds = $rolePageMap[$role->id] ?? [];

            if (strcasecmp((string) $role->name, 'Main Admin') === 0) {
                $pageIds = $pages->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
            }

            return [
                'role_id' => (int) $role->id,
                'page_ids' => array_values(array_map('intval', $pageIds)),
            ];
        })->values();

        return response()->json($map);
    }

    public function roleModulesMatrix()
    {
        $roles = $this->rolePermissionSyncService->listAdminAssignableRoles()
            ->sortBy('id')
            ->values();

        $pages = Page::query()
            ->where('is_active', true)
            ->orderBy('category')
            ->orderBy('name')
            ->get(['id', 'name', 'path', 'category', 'permission_name']);

        $rolePageMap = $this->buildRolePageMap($roles, $pages);

        $modulesByRole = [];
        foreach ($roles as $role) {
            $roleName = (string) $role->name;

            if (strcasecmp($roleName, 'Main Admin') === 0) {
                $modulesByRole[$roleName] = $pages
                    ->pluck('name')
                    ->map(fn ($name) => (string) $name)
                    ->values()
                    ->all();
                continue;
            }

            $pageIds = $rolePageMap[(int) $role->id] ?? [];
            $modulesByRole[$roleName] = $pages
                ->filter(fn (Page $page) => in_array((int) $page->id, $pageIds, true))
                ->pluck('name')
                ->map(fn ($name) => (string) $name)
                ->values()
                ->all();
        }

        return response()->json([
            'roles' => $roles->map(fn (Role $role) => ['id' => (int) $role->id, 'name' => (string) $role->name])->values(),
            'pages' => $pages->values(),
            'role_modules' => $modulesByRole,
        ]);
    }

    public function myPages(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $roleIds = $user->roles
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($roleIds->isEmpty()) {
            return response()->json(['pages' => []]);
        }

        $pages = Page::query()->where('is_active', true)->orderBy('category')->orderBy('name')->get();
        $roles = Role::query()->whereIn('id', $roleIds)->get(['id', 'name']);
        $rolePageMap = $this->buildRolePageMap($roles, $pages);

        $accessiblePageIds = collect($rolePageMap)
            ->flatten()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $hasMainAdmin = $roles->contains(fn (Role $role) => strcasecmp((string) $role->name, 'Main Admin') === 0);
        if ($hasMainAdmin) {
            $accessiblePageIds = $pages->pluck('id')->map(fn ($id) => (int) $id)->values();
        }

        $accessiblePages = $pages
            ->filter(fn (Page $page) => $accessiblePageIds->contains((int) $page->id))
            ->values()
            ->map(fn (Page $page) => [
                'id' => (int) $page->id,
                'name' => (string) $page->name,
                'path' => (string) $page->path,
                'category' => $page->category,
                'permission_name' => (string) $page->permission_name,
            ]);

        return response()->json(['pages' => $accessiblePages]);
    }

    public function syncPages(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pages' => 'required|array',
            'pages.*.name' => 'required|string',
            'pages.*.path' => 'required|string',
            'pages.*.category' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $synced = [];
        
        foreach ($request->pages as $pageData) {
            $slug = Str::slug($pageData['path'], '-');
            $permissionName = 'access:' . $slug;

            $page = Page::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $pageData['name'],
                    'path' => $pageData['path'],
                    'category' => $pageData['category'] ?? null,
                    'permission_name' => $permissionName,
                    'is_active' => true,
                ]
            );

            Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
            $synced[] = $page;
        }

        $this->rolePermissionSyncService->syncDefaultPagePermissions(collect($synced));

        return response()->json(['message' => 'Pages synced and default permissions assigned', 'pages' => $synced]);
    }

    public function assignToRole(Request $request, int $roleId)
    {
        $validator = Validator::make($request->all(), [
            'page_ids' => 'required|array',
            'page_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $role = Role::findOrFail($roleId);
        if (strtolower((string) $role->name) === 'student') {
            return response()->json([
                'message' => 'Student role is excluded from admin page permission management.',
            ], 422);
        }

        $pages = Page::whereIn('id', $request->page_ids)->get();
        $pagePermissions = $pages->pluck('permission_name');

        $this->rolePermissionSyncService->syncRolePagePermissions($role, $pagePermissions);

        return response()->json(['message' => 'Role page permissions updated']);
    }

    public function updateRoleModules(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role_modules' => 'required|array',
            'role_modules.*' => 'array',
            'role_modules.*.*' => 'string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pagesByName = Page::query()
            ->where('is_active', true)
            ->get(['name', 'permission_name'])
            ->keyBy('name');

        foreach ($request->role_modules as $roleName => $moduleNames) {
            $normalizedRoleName = strtolower(trim((string) $roleName));
            if ($normalizedRoleName === 'student') {
                continue;
            }

            // Main Admin is always full-access and cannot be reduced from UI payloads.
            if ($normalizedRoleName === 'main admin') {
                continue;
            }

            $role = Role::where('name', $roleName)
                ->where('guard_name', 'web')
                ->first();
            if (!$role || !is_array($moduleNames)) {
                continue;
            }

            $pagePermissions = collect($moduleNames)
                ->map(fn ($moduleName) => trim((string) $moduleName))
                ->filter()
                ->map(fn ($moduleName) => $pagesByName->get($moduleName)?->permission_name)
                ->filter()
                ->values();

            $this->rolePermissionSyncService->syncRolePagePermissions($role, $pagePermissions);
        }

        // Enforce Main Admin full page access on every save.
        $mainAdminRole = Role::query()
            ->where('guard_name', 'web')
            ->whereRaw('LOWER(name) = ?', ['main admin'])
            ->first();
        if ($mainAdminRole) {
            $mainAdminPermissions = $pagesByName
                ->pluck('permission_name')
                ->filter()
                ->values();
            $this->rolePermissionSyncService->syncRolePagePermissions($mainAdminRole, $mainAdminPermissions);
        }

        return response()->json(['message' => 'Role module permissions updated successfully']);
    }

    private function buildRolePageMap(Collection $roles, Collection $pages): array
    {
        $roleIds = $roles->pluck('id')->map(fn ($id) => (int) $id)->values();
        $permissionToPageId = $pages
            ->filter(fn (Page $page) => !empty($page->permission_name))
            ->mapWithKeys(fn (Page $page) => [(string) $page->permission_name => (int) $page->id]);

        if ($roleIds->isEmpty() || $permissionToPageId->isEmpty()) {
            return [];
        }

        $roleHasPermissionsTable = config('permission.table_names.role_has_permissions', 'role_has_permissions');
        $permissionsTable = config('permission.table_names.permissions', 'permissions');

        $rows = DB::table($roleHasPermissionsTable)
            ->join($permissionsTable, "{$permissionsTable}.id", '=', "{$roleHasPermissionsTable}.permission_id")
            ->whereIn("{$roleHasPermissionsTable}.role_id", $roleIds->all())
            ->whereIn("{$permissionsTable}.name", $permissionToPageId->keys()->all())
            ->get([
                "{$roleHasPermissionsTable}.role_id as role_id",
                "{$permissionsTable}.name as permission_name",
            ]);

        $map = [];
        foreach ($rows as $row) {
            $roleId = (int) $row->role_id;
            $permissionName = (string) $row->permission_name;
            $pageId = $permissionToPageId->get($permissionName);
            if (!$pageId) {
                continue;
            }
            if (!isset($map[$roleId])) {
                $map[$roleId] = [];
            }
            $map[$roleId][] = (int) $pageId;
        }

        foreach ($map as $roleId => $pageIds) {
            $map[$roleId] = array_values(array_unique($pageIds));
        }

        return $map;
    }
}
