<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Page;
use App\Services\RolePermissionSyncService;
use Illuminate\Http\Request;
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

        $pagesWithRoles = $pages->map(function (Page $page) use ($roles) {
            $roleMatches = $roles->filter(function (Role $role) use ($page) {
                try {
                    return $role->hasPermissionTo($page->permission_name);
                } catch (\Exception $e) {
                    return false; // Permission doesn't exist yet
                }
            })->values()->map(fn (Role $role) => ['id' => $role->id, 'name' => $role->name]);

            return array_merge($page->toArray(), ['roles' => $roleMatches]);
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
        $pages = Page::all();

        $map = $roles->map(function (Role $role) use ($pages) {
            $pageIds = $pages->filter(function (Page $page) use ($role) {
                try {
                    return $role->hasPermissionTo($page->permission_name);
                } catch (\Exception $e) {
                    return false; // Permission doesn't exist yet
                }
            })->pluck('id')->values();
            
            return [
                'role_id' => $role->id,
                'page_ids' => $pageIds,
            ];
        });

        return response()->json($map);
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
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->role_modules as $roleName => $moduleNames) {
            if (strtolower((string) $roleName) === 'student') {
                continue;
            }

            $role = Role::where('name', $roleName)->first();
            if (!$role) continue;

            $pages = Page::whereIn('name', $moduleNames)->get();
            $pagePermissions = $pages->pluck('permission_name');

            $this->rolePermissionSyncService->syncRolePagePermissions($role, $pagePermissions);
        }

        return response()->json(['message' => 'Role module permissions updated successfully']);
    }
}
