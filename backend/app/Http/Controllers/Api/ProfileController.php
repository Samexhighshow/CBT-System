<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use App\Mail\TwoFactorOtpMail;
use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

class ProfileController extends Controller
{
    /**
     * Get current user profile
     */
    public function show(Request $request)
    {
        $user = $request->user()->load('roles');
        return response()->json($user);
    }

    /**
     * Update profile information
     */
    public function update(Request $request)
    {
        $user = $request->user();
        
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user
        ]);
    }

    /**
     * Update profile picture
     */
    public function updatePicture(Request $request)
    {
        $validated = $request->validate([
            'picture' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $user = $request->user();

        // Delete old picture if exists
        if ($user->profile_picture) {
            Storage::disk('public')->delete($user->profile_picture);
        }

        // Store new picture
        $path = $request->file('picture')->store('profile-pictures', 'public');
        
        $user->update(['profile_picture' => $path]);

        return response()->json([
            'message' => 'Profile picture updated successfully',
            'picture_url' => Storage::url($path)
        ]);
    }

    /**
     * Remove profile picture
     */
    public function removePicture(Request $request)
    {
        $user = $request->user();

        if ($user->profile_picture) {
            Storage::disk('public')->delete($user->profile_picture);
            $user->update(['profile_picture' => null]);
        }

        return response()->json(['message' => 'Profile picture removed successfully']);
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->update([
            'password' => Hash::make($validated['new_password'])
        ]);

        return response()->json(['message' => 'Password changed successfully']);
    }

    /**
     * Enable/Setup Google Authenticator 2FA
     */
    public function setupGoogle2FA(Request $request)
    {
        $user = $request->user();
        $google2fa = new Google2FA();

        // Generate secret key
        $secret = $google2fa->generateSecretKey();
        
        // Generate QR code URL
        $qrCodeUrl = $google2fa->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $secret
        );

        // Store secret temporarily (will be confirmed on verification)
        $user->update(['google2fa_secret_temp' => $secret]);

        return response()->json([
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
            'message' => 'Scan the QR code with Google Authenticator app and verify with a code'
        ]);
    }

    /**
     * Verify and enable Google Authenticator
     */
    public function verifyGoogle2FA(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $google2fa = new Google2FA();

        $valid = $google2fa->verifyKey($user->google2fa_secret_temp ?? '', $validated['code']);

        if (!$valid) {
            return response()->json(['message' => 'Invalid verification code'], 422);
        }

        // Generate recovery codes
        $recoveryCodes = [];
        for ($i = 0; $i < 8; $i++) {
            $recoveryCodes[] = strtoupper(bin2hex(random_bytes(5)));
        }

        // Enable 2FA
        $user->update([
            'google2fa_secret' => $user->google2fa_secret_temp,
            'google2fa_secret_temp' => null,
            'two_factor_type' => 'google_authenticator',
            'two_factor_enabled' => true,
            'two_factor_recovery_codes' => json_encode(array_map(fn($code) => Hash::make($code), $recoveryCodes)),
        ]);

        return response()->json([
            'message' => 'Google Authenticator enabled successfully',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Enable Email OTP 2FA
     */
    public function enableEmailOTP(Request $request)
    {
        $user = $request->user();
        
        // Generate and send OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        $user->update([
            'two_factor_code' => $otp,
            'two_factor_expires_at' => now()->addMinutes(10),
        ]);

        try {
            Mail::to($user->email)->send(new TwoFactorOtpMail($otp));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to send OTP email'], 500);
        }

        return response()->json(['message' => 'OTP sent to your email. Please verify to enable 2FA.']);
    }

    /**
     * Verify Email OTP and enable 2FA
     */
    public function verifyEmailOTP(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();

        if (!$user->two_factor_code || $user->two_factor_code !== $validated['code']) {
            return response()->json(['message' => 'Invalid OTP code'], 422);
        }

        if (now()->greaterThan($user->two_factor_expires_at)) {
            return response()->json(['message' => 'OTP code has expired'], 422);
        }

        $user->update([
            'two_factor_type' => 'email_otp',
            'two_factor_enabled' => true,
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
        ]);

        return response()->json(['message' => 'Email OTP 2FA enabled successfully']);
    }

    /**
     * Disable Two-Factor Authentication
     */
    public function disable2FA(Request $request)
    {
        $validated = $request->validate([
            'password' => 'required',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json(['message' => 'Password is incorrect'], 422);
        }

        $user->update([
            'two_factor_enabled' => false,
            'two_factor_type' => null,
            'google2fa_secret' => null,
            'google2fa_secret_temp' => null,
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
        ]);

        return response()->json(['message' => 'Two-factor authentication disabled successfully']);
    }

    /**
     * Get 2FA status
     */
    public function get2FAStatus(Request $request)
    {
        $user = $request->user();
        
        return response()->json([
            'enabled' => $user->two_factor_enabled ?? false,
            'type' => $user->two_factor_type ?? null,
        ]);
    }
}
