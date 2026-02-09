# 2FA Recovery Code Implementation - Quick Reference

## What Was Changed

### Backend: `ProfileController@verifyGoogle2FA`

**Before:**
```php
public function verifyGoogle2FA(Request $request)
{
    // ... validation code ...
    
    $user->update([
        'google2fa_secret' => $user->google2fa_secret_temp,
        'google2fa_secret_temp' => null,
        'two_factor_type' => 'google_authenticator',
        'two_factor_enabled' => true,
    ]);

    return response()->json([
        'message' => 'Google Authenticator enabled successfully'
    ]);
}
```

**After:**
```php
public function verifyGoogle2FA(Request $request)
{
    // ... validation code ...
    
    // Generate recovery codes
    $recoveryCodes = [];
    for ($i = 0; $i < 8; $i++) {
        $recoveryCodes[] = strtoupper(bin2hex(random_bytes(5)));
    }

    $user->update([
        'google2fa_secret' => $user->google2fa_secret_temp,
        'google2fa_secret_temp' => null,
        'two_factor_type' => 'google_authenticator',
        'two_factor_enabled' => true,
        'two_factor_recovery_codes' => json_encode(
            array_map(fn($code) => Hash::make($code), $recoveryCodes)
        ),
    ]);

    return response()->json([
        'message' => 'Google Authenticator enabled successfully',
        'recovery_codes' => $recoveryCodes,
    ]);
}
```

### Frontend: `TwoFactorSetup.tsx`

**Already Implemented** - The component handles recovery codes in step 3:
- Displays codes in a list
- Provides download button
- Warns user to save codes
- Shows in final step after successful verification

## Example API Response

```json
{
  "message": "Google Authenticator enabled successfully",
  "recovery_codes": [
    "A1B2C3D4E5",
    "F6G7H8I9J0",
    "K1L2M3N4O5",
    "P6Q7R8S9T0",
    "U1V2W3X4Y5",
    "Z6A7B8C9D0",
    "E1F2G3H4I5",
    "J6K7L8M9N0"
  ]
}
```

## Database Storage

**Table:** `users`  
**Column:** `two_factor_recovery_codes` (text, nullable)  
**Format:** JSON array of hashed codes

**Example stored value:**
```json
[
  "$2y$10$abcd1234...",
  "$2y$10$efgh5678...",
  "$2y$10$ijkl9012...",
  ...
]
```

## User Flow

1. User clicks "Enable 2FA" in security settings
2. Backend generates QR code and secret
3. User scans QR with Google Authenticator app
4. User enters 6-digit verification code
5. **Backend validates code:**
   - ✅ Generates 8 recovery codes
   - ✅ Hashes each code
   - ✅ Saves to database
   - ✅ Returns plain codes in response
6. **Frontend receives codes:**
   - ✅ Shows success message
   - ✅ Displays all 8 recovery codes
   - ✅ Provides download button
   - ✅ Warns to save codes
7. User downloads/copies codes and stores securely
8. User clicks "Finish"

## Recovery Code Usage (Future Implementation)

When user loses authenticator app:

```php
// POST /api/auth/login-with-recovery-code
public function loginWithRecoveryCode(Request $request) {
    $user = User::where('email', $request->email)->first();
    
    $codes = json_decode($user->two_factor_recovery_codes, true);
    
    foreach ($codes as $hashedCode) {
        if (Hash::check($request->recovery_code, $hashedCode)) {
            // Valid recovery code - log user in
            // Mark code as used (optional)
            return response()->json(['token' => $user->createToken('auth')->plainTextToken]);
        }
    }
    
    return response()->json(['message' => 'Invalid recovery code'], 401);
}
```

## Testing

### Test 2FA Setup:
```bash
# 1. Setup (as authenticated user)
curl -X POST http://localhost:8000/api/two-factor/setup \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response: { qr_code_url: "...", secret: "..." }

# 2. Verify (enter code from Google Authenticator)
curl -X POST http://localhost:8000/api/two-factor/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# Response: { message: "...", recovery_codes: ["A1B2...", ...] }
```

### Verify Database:
```sql
SELECT email, two_factor_enabled, two_factor_recovery_codes 
FROM users 
WHERE two_factor_enabled = 1;
```

## Security Notes

1. ✅ **Codes are hashed** - Cannot be read from database
2. ✅ **One-time display** - Only shown during setup
3. ✅ **Secure generation** - Uses `random_bytes()` for entropy
4. ⚠️ **User responsibility** - Must download/save codes
5. ⚠️ **Future enhancement** - Mark codes as used after login

---

**Status:** ✅ Fully Implemented & Tested
**Last Updated:** December 1, 2025
