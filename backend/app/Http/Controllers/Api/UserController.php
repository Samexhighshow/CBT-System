<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('roles');
        if ($request->get('only_applicants')) {
            $query->whereDoesntHave('roles');
        }

        $perPage = $request->input('limit', 15);
        $users = $query->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $users->items(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
            'per_page' => $users->perPage(),
            'total' => $users->total(),
            'next_page' => $users->currentPage() < $users->lastPage() ? $users->currentPage() + 1 : null,
            'prev_page' => $users->currentPage() > 1 ? $users->currentPage() - 1 : null,
        ]);
    }

    public function store(Request $request)
    {
        // Admin signup applicant
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'phone_number' => 'required|string|max:20',
            'passport_picture' => 'nullable|image|max:2048' // Max 2MB, optional
        ]);

        // Handle file upload
        $profilePicturePath = null;
        if ($request->hasFile('passport_picture')) {
            $file = $request->file('passport_picture');
            $uploadDir = public_path('uploads/profile_pictures');

            if (!File::exists($uploadDir)) {
                File::makeDirectory($uploadDir, 0755, true);
            }

            $filename = time() . '_' . preg_replace('/\s+/', '_', $file->getClientOriginalName());
            $file->move($uploadDir, $filename);
            $profilePicturePath = 'uploads/profile_pictures/' . $filename;
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone_number' => $validated['phone_number'],
            'profile_picture' => $profilePicturePath,
        ]);

        // Check if this is the first admin user (now count is 1 inclusive of this new user)
        $isFirstAdmin = User::count() === 1;

        if ($isFirstAdmin) {
            // Auto-verify and assign Main Admin role to first user
            $user->markEmailAsVerified();
            $user->assignRole('Main Admin');
            $message = 'First admin account created successfully with Main Admin privileges';
            $token = $user->createToken('api')->plainTextToken; // Create token for immediate login

            return response()->json([
                'message' => $message,
                'user' => $user,
                'is_first_admin' => true,
                'token' => $token
            ], 201);
        } else {
            // Send pending approval email
            try {
                \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\AdminApprovalPending($user));
            } catch (\Exception $e) {
                Log::warning('Failed to send pending approval email: ' . $e->getMessage());
            }
            $message = 'Account created. Pending administrator approval.';

            return response()->json([
                'message' => $message,
                'user' => $user,
                'is_first_admin' => false
            ], 201);
        }
    }

    public function getTeachers()
    {
        $teachers = User::whereHas('roles', function ($query) {
            $query->where('name', 'Teacher');
        })->with('roles')->get();

        return response()->json([
            'data' => $teachers
        ]);
    }
}
