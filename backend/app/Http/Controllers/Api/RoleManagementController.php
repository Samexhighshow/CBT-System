<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;

class RoleManagementController extends Controller
{
    public function listRoles()
    {
        $roles = Role::orderBy('name')->get(['id', 'name']);
        return response()->json($roles);
    }

    public function listUsers()
    {
        $users = User::with('roles:id,name')->orderBy('id', 'asc')->get(['id', 'name', 'email']);
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

        $user = User::findOrFail($userId);
        $role = Role::where('name', $request->role)->first();

        if (!$role) {
            return response()->json(['message' => 'Role not found'], 404);
        }

        $user->syncRoles([$role->name]);

        return response()->json(['message' => 'Role assigned successfully']);
    }
}
