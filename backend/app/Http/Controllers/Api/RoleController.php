<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function assignRole(Request $request, $userId)
    {
        $request->validate([
            'role' => 'required|string|exists:roles,name'
        ]);

        $user = User::findOrFail($userId);
        $role = Role::where('name', $request->role)->firstOrFail();

        $user->syncRoles([$role->name]);

        return response()->json(['message' => 'Role assigned successfully', 'user' => $user->load('roles')]);
    }

    public function listRoles()
    {
        $roles = Role::query()->pluck('name')->filter(fn($r) => $r !== 'Main Admin')->values();
        return response()->json($roles);
    }
}
