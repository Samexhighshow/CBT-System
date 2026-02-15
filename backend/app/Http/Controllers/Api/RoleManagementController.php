<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Page;
use App\Models\User;
use App\Services\RolePermissionSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class RoleManagementController extends Controller
{
    private const PROTECTED_ROLES = [
        'main admin',
        'student',
    ];

    public function __construct(
        private readonly RolePermissionSyncService $rolePermissionSyncService
    ) {
    }

    public function listRoles(): JsonResponse
    {
        $roles = $this->rolePermissionSyncService
            ->listAdminAssignableRoles()
            ->map(function (Role $role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'users_count' => $role->users()->count(),
                    'permissions_count' => $role->permissions()->count(),
                ];
            })
            ->values();

        return response()->json($roles);
    }

    public function createRole(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:80',
                Rule::unique('roles', 'name'),
            ],
            'clone_from_role_id' => 'nullable|integer|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $name = trim((string) $request->input('name'));
        if ($this->isReservedRoleName($name)) {
            return response()->json([
                'message' => 'This role name is reserved and cannot be created from admin management.',
            ], 422);
        }

        $role = Role::create([
            'name' => $name,
            'guard_name' => 'web',
        ]);

        $pages = Page::query()->where('is_active', true)->get();
        $cloneFromRoleId = $request->input('clone_from_role_id');

        if ($cloneFromRoleId) {
            $sourceRole = Role::find($cloneFromRoleId);
            if ($sourceRole) {
                $pagePermissions = $sourceRole->permissions
                    ->pluck('name')
                    ->filter(fn ($permName) => str_starts_with((string) $permName, 'access:'))
                    ->values();
                $this->rolePermissionSyncService->syncRolePagePermissions($role, $pagePermissions);
            }
        } else {
            $this->rolePermissionSyncService->applyDefaultPermissionsForRole($role, $pages);
        }

        return response()->json([
            'message' => 'Role created successfully',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
        ], 201);
    }

    public function updateRole(Request $request, int $roleId): JsonResponse
    {
        $role = Role::findOrFail($roleId);

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:80',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($this->isProtectedRole($role->name)) {
            return response()->json([
                'message' => 'This role cannot be renamed.',
            ], 403);
        }

        $newName = trim((string) $request->input('name'));
        if ($this->isReservedRoleName($newName)) {
            return response()->json([
                'message' => 'This role name is reserved and cannot be used.',
            ], 422);
        }

        $role->name = $newName;
        $role->save();
        $this->rolePermissionSyncService->applyDefaultPermissionsForRole($role);

        return response()->json([
            'message' => 'Role updated successfully',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
        ]);
    }

    public function deleteRole(int $roleId): JsonResponse
    {
        $role = Role::findOrFail($roleId);

        if ($this->isProtectedRole($role->name)) {
            return response()->json([
                'message' => 'This role cannot be deleted.',
            ], 403);
        }

        if ($role->users()->exists()) {
            return response()->json([
                'message' => 'Cannot delete role while users are still assigned to it.',
            ], 422);
        }

        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully',
        ]);
    }

    public function syncDefaults(): JsonResponse
    {
        $this->rolePermissionSyncService->syncDefaultPagePermissions();

        return response()->json([
            'message' => 'Default role-page permissions synced successfully.',
        ]);
    }

    public function listUsers()
    {
        $users = User::with('roles:id,name')
            ->orderBy('id', 'asc')
            ->get(['id', 'name', 'email']);

        return response()->json($users);
    }

    public function assignRole(Request $request, int $userId)
    {
        $validator = Validator::make($request->all(), [
            'role' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $roleName = trim((string) $request->input('role'));
        if ($this->isReservedRoleName($roleName)) {
            return response()->json([
                'message' => 'Student role cannot be assigned from admin role management.',
            ], 422);
        }

        if (strcasecmp($roleName, 'Main Admin') === 0 && !$request->user()?->hasRole('Main Admin')) {
            return response()->json([
                'message' => 'Only Main Admin can assign the Main Admin role.',
            ], 403);
        }

        $user = User::findOrFail($userId);
        $role = Role::where('name', $roleName)->first();

        if (!$role) {
            return response()->json(['message' => 'Role not found'], 404);
        }

        $user->syncRoles([$role->name]);

        return response()->json(['message' => 'Role assigned successfully']);
    }

    private function isReservedRoleName(string $name): bool
    {
        return strtolower(trim($name)) === 'student';
    }

    private function isProtectedRole(string $name): bool
    {
        return in_array(strtolower(trim($name)), self::PROTECTED_ROLES, true);
    }
}
