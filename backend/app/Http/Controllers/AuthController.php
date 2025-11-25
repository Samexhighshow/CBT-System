<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Student;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate(['email' => 'required|email', 'password' => 'required']);

        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('device-token')->plainTextToken;
        return response()->json(['token' => $token, 'user' => $user]);
    }

    public function register(Request $request)
    {
        // Registration endpoint for students. Validate registration window elsewhere (middleware)
        $data = $request->validate([
            'first_name' => 'required',
            'last_name' => 'required',
            'email' => 'required|email|unique:students,email',
            'phone' => 'nullable',
            'class_level' => 'required'
        ]);

        $studentId = 'S' . strtoupper(uniqid());
        $student = Student::create(array_merge($data, ['student_id' => $studentId]));

        return response()->json(['student' => $student], 201);
    }
}
