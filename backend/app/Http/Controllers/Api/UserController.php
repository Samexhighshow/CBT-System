<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('roles');
        if ($request->get('only_applicants')) {
            $query->whereDoesntHave('roles');
        }
        return response()->json($query->orderBy('id','desc')->paginate(20));
    }

    public function store(Request $request)
    {
        // Admin signup applicant (no role yet, not verified)
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8'
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        // Try to send verification email (don't fail if mail server not configured)
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Exception $e) {
            Log::warning('Failed to send verification email: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Admin application submitted successfully', 'user' => $user], 201);
    }
}
