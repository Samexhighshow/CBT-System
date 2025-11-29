<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

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

        // Send verification email
        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Admin application submitted', 'user' => $user], 201);
    }
}
