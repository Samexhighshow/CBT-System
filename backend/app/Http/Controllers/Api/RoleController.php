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

        if (strtolower(trim((string) $request->role)) === 'student') {
            return response()->json([
                'message' => 'Student role is managed by student registration flow and cannot be assigned here.'
            ], 422);
        }

        if (strcasecmp((string) $request->role, 'Main Admin') === 0 && !$request->user()?->hasRole('Main Admin')) {
            return response()->json([
                'message' => 'Only Main Admin can assign Main Admin role.'
            ], 403);
        }

        $user = User::findOrFail($userId);
        $role = Role::where('name', $request->role)->firstOrFail();

        $user->syncRoles([$role->name]);

        return response()->json(['message' => 'Role assigned successfully', 'user' => $user->load('roles')]);
    }

    public function listRoles()
    {
        $roles = Role::query()
            ->pluck('name')
            ->filter(function ($name) {
                $normalized = strtolower(trim((string) $name));
                return !in_array($normalized, ['main admin', 'student'], true);
            })
            ->values();

        return response()->json($roles);
    }
}
