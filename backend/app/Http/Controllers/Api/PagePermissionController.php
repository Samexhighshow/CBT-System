<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PagePermissionController extends Controller
{
    public function index()
    {
        $pages = Page::orderBy('category')->orderBy('name')->get();
        $roles = Role::orderBy('name')->get();

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
        $roles = Role::orderBy('id')->get();
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
        $allPermissions = [];
        
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

            Permission::firstOrCreate(['name' => $permissionName]);
            $allPermissions[] = $permissionName;
            $synced[] = $page;
        }

        // Auto-assign permissions to roles based on page names
        $pagesByName = [];
        foreach ($synced as $page) {
            $pagesByName[$page->name] = $page->permission_name;
        }

        $roleDefaults = [
            'Main Admin' => $allPermissions, // Full access to everything
            'Admin' => array_values(array_filter($pagesByName, function($name) {
                // Admin gets most things except system-level management
                $excluded = ['Users', 'Roles', 'System Settings'];
                return !in_array($name, $excluded);
            }, ARRAY_FILTER_USE_KEY)),
            'Sub-Admin' => array_values(array_intersect_key($pagesByName, array_flip([
                'Overview', 'Questions', 'Exams', 'Students', 'Results', 'Academic Management'
            ]))),
            'Moderator' => array_values(array_intersect_key($pagesByName, array_flip([
                'Overview', 'Exams', 'Students', 'Results'
            ]))),
            'Teacher' => array_values(array_intersect_key($pagesByName, array_flip([
                'Overview', 'Questions', 'Results'
            ]))),
        ];

        foreach ($roleDefaults as $roleName => $permissions) {
            $role = Role::where('name', $roleName)->first();
            if (!$role) continue;

            try {
                $existingPermissions = $role->permissions()->pluck('name');
                $nonPagePermissions = $existingPermissions->filter(fn ($name) => !str_starts_with($name, 'access:'));
                $role->syncPermissions($nonPagePermissions->merge($permissions));
            } catch (\Exception $e) {
                // If sync fails, just assign the new permissions individually
                foreach ($permissions as $permission) {
                    try {
                        $role->givePermissionTo($permission);
                    } catch (\Exception $ex) {
                        // Skip if already assigned
                    }
                }
            }
        }

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
        $pages = Page::whereIn('id', $request->page_ids)->get();
        $pagePermissions = $pages->pluck('permission_name');

        $existingPermissions = $role->permissions()->pluck('name');
        $nonPagePermissions = $existingPermissions->filter(fn ($name) => !str_starts_with($name, 'access:'));

        $role->syncPermissions($nonPagePermissions->merge($pagePermissions));

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
            $role = Role::where('name', $roleName)->first();
            if (!$role) continue;

            $pages = Page::whereIn('name', $moduleNames)->get();
            $pagePermissions = $pages->pluck('permission_name');

            $existingPermissions = $role->permissions()->pluck('name');
            $nonPagePermissions = $existingPermissions->filter(fn ($name) => !str_starts_with($name, 'access:'));

            $role->syncPermissions($nonPagePermissions->merge($pagePermissions));
        }

        return response()->json(['message' => 'Role module permissions updated successfully']);
    }
}
