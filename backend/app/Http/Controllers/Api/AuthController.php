<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;
use App\Models\PasswordResetCode;
use App\Mail\PasswordResetOtpMail;
use Illuminate\Support\Facades\Auth;
use App\Models\Student;
use App\Models\User;
use App\Models\SystemSetting;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    private function settingAsBoolean($value, bool $fallback = false): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return ((int) $value) === 1;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
                return false;
            }
        }

        return $fallback;
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string'
        ]);

        // Check if user exists
        $user = User::where('email', $credentials['email'])->first();

        // Backfill user account for legacy student records that exist only in students table.
        if (!$user) {
            $student = Student::where('email', $credentials['email'])->first();
            if ($student && !empty($student->password)) {
                $fullName = trim(
                    ($student->first_name ?? '') . ' ' .
                    ($student->last_name ?? '') . ' ' .
                    ($student->other_names ?? '')
                );

                $user = User::create([
                    'name' => $fullName !== '' ? $fullName : $student->email,
                    'email' => $student->email,
                    'password' => $student->password,
                    'phone_number' => $student->phone_number ?? $student->phone ?? null,
                ]);

                $studentRole = Role::firstOrCreate([
                    'name' => 'student',
                    'guard_name' => 'web',
                ]);
                $user->assignRole($studentRole);
                $user->markEmailAsVerified();
            }
        }

        if (!$user) {
            return response()->json([
                'message' => 'No account found with this email address.',
                'error_type' => 'email_not_found'
            ], 401);
        }

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'message' => 'Incorrect password. Please check your password and try again.',
                'error_type' => 'invalid_password'
            ], 401);
        }

        $user = $request->user();

        $loginContext = strtolower((string) $request->input('login_context', ''));
        $roleNames = $user->roles
            ->map(fn ($role) => strtolower((string) ($role->name ?? $role)))
            ->values()
            ->all();

        // Check if email is verified (only if NOT the first user/admin who is auto-verified? 
        // Actually, logic: If Main Admin -> allow. If Other Role -> allow. If No Role -> block.
        // We can skip email verification check if user has Main Admin role, or keep it.
        // But the requirement says "first user... skips email verification". We did markEmailAsVerified() in store(), so hasVerifiedEmail() will be true.

        // Block login if user has NO roles (Pending Approval)
        if ($user->roles->isEmpty()) {
            Auth::logout();
            return response()->json([
                'message' => 'Your account is pending administrator approval.',
                'pending_approval' => true
            ], 403);
        }

        if ($loginContext === 'student' && !in_array('student', $roleNames, true)) {
            Auth::logout();
            return response()->json([
                'message' => 'This account is not permitted on the student portal.',
                'error_type' => 'role_not_student'
            ], 403);
        }

        if ($loginContext === 'admin') {
            $adminRoles = ['admin', 'main admin', 'teacher'];
            $hasAdminRole = count(array_intersect($roleNames, $adminRoles)) > 0;
            if (!$hasAdminRole) {
                Auth::logout();
                return response()->json([
                    'message' => 'This account is not permitted on the admin portal.',
                    'error_type' => 'role_not_admin'
                ], 403);
            }
        }

        $requireEmailVerification = $this->settingAsBoolean(
            SystemSetting::get('require_email_verification', true),
            true
        );

        if ($requireEmailVerification && !$user->hasVerifiedEmail()) {
            Auth::logout();
            return response()->json([
                'message' => 'Please verify your email before logging in. Check your inbox for the verification link.',
                'email_verified' => false,
                'email' => $user->email
            ], 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load('roles'),
        ]);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->currentAccessToken()?->delete();
        }
        return response()->json(['message' => 'Logged out']);
    }

    public function sendVerification(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $user = User::where('email', $request->email)->firstOrFail();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified'], 200);
        }
        $user->sendEmailVerificationNotification();
        return response()->json(['message' => 'Verification email sent']);
    }

    public function verifyEmail(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $request->validate(['hash' => 'required']);
        if (!hash_equals((string) $request->hash, sha1($user->getEmailForVerification()))) {
            return response()->json(['message' => 'Invalid verification link'], 422);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Already verified'], 200);
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return response()->json(['message' => 'Email verified successfully']);
    }

    public function sendPasswordResetLink(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $status = Password::sendResetLink($request->only('email'));
        return $status === Password::RESET_LINK_SENT
            ? response()->json(['message' => __($status)])
            : response()->json(['message' => __($status)], 422);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->password = bcrypt($password);
                $user->save();
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['message' => __($status)])
            : response()->json(['message' => __($status)], 422);
    }

    public function requestPasswordOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'If the email exists, an OTP will be sent']);
        }
        $length = (int) env('OTP_LENGTH', 6);
        $expiryMinutes = (int) env('OTP_EXPIRY_MINUTES', 10);
        $code = str_pad((string) random_int(0, pow(10, $length) - 1), $length, '0', STR_PAD_LEFT);

        PasswordResetCode::where('email', $user->email)->delete();
        PasswordResetCode::create([
            'email' => $user->email,
            'code' => $code,
            'expires_at' => Carbon::now()->addMinutes($expiryMinutes),
        ]);

        Mail::to($user->email)->send(new PasswordResetOtpMail($code, $expiryMinutes));
        return response()->json(['message' => 'OTP sent if account exists']);
    }

    public function resetPasswordWithOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        $record = PasswordResetCode::where('email', $request->email)->where('code', $request->code)->first();
        if (!$record) {
            return response()->json(['message' => 'Invalid code'], 422);
        }
        if ($record->used_at) {
            return response()->json(['message' => 'Code already used'], 422);
        }
        if ($record->expires_at->isPast()) {
            return response()->json(['message' => 'Code expired'], 422);
        }

        $user = User::where('email', $request->email)->firstOrFail();
        $user->password = bcrypt($request->password);
        $user->save();
        $record->used_at = Carbon::now();
        $record->save();

        return response()->json(['message' => 'Password reset successfully']);
    }
}
