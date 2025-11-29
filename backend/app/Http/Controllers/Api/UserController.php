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

        // Check if this is the first admin user
        $isFirstAdmin = User::count() === 1;
        
        if ($isFirstAdmin) {
            // Auto-verify and assign Main Admin role to first user
            $user->markEmailAsVerified();
            $user->assignRole('Main Admin');
            $message = 'First admin account created successfully with Main Admin privileges';
        } else {
            // Try to send verification email (don't fail if mail server not configured)
            try {
                $user->sendEmailVerificationNotification();
            } catch (\Exception $e) {
                Log::warning('Failed to send verification email: ' . $e->getMessage());
            }
            $message = 'Admin application submitted successfully';
        }

        return response()->json(['message' => $message, 'user' => $user, 'is_first_admin' => $isFirstAdmin], 201);
    }
}
