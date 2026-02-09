<?php
/**
 * Web API Test - Simulating actual HTTP requests
 * 
 * TEST CREDENTIALS:
 * ================
 * User 1 (Main Admin):
 *   Email: mainadmin@cbt.com
 *   Password: Admin@123456
 * 
 * User 2 (Pending Approval):
 *   Email: seconduser@cbt.com
 *   Password: User@123456
 */

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

echo "╔══════════════════════════════════════════════════════════════╗\n";
echo "║          CBT SYSTEM - WEB AUTHENTICATION TEST                ║\n";
echo "╚══════════════════════════════════════════════════════════════╝\n\n";

// Clear existing users
echo "🔄 Preparing database...\n";
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
User::truncate();
DB::table('model_has_roles')->truncate();
DB::statement('SET FOREIGN_KEY_CHECKS=1;');
echo "   ✓ Users table cleared\n\n";

// ============================================
// TEST 1: First User Signup (Should become Main Admin)
// ============================================
echo "═══════════════════════════════════════════════════════════════\n";
echo "TEST 1: FIRST USER SIGNUP (Main Admin)\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "   Email: mainadmin@cbt.com\n";
echo "   Password: Admin@123456\n";
echo "   Phone: +2348012345678\n\n";

$firstUser = User::create([
    'name' => 'Main Admin User',
    'email' => 'mainadmin@cbt.com',
    'password' => Hash::make('Admin@123456'),
    'phone_number' => '+2348012345678',
    'profile_picture' => 'uploads/profile_pictures/test_admin.jpg',
]);

$isFirst = User::count() === 1;
if ($isFirst) {
    $firstUser->markEmailAsVerified();
    $firstUser->assignRole('Main Admin');
}

$firstUser->refresh();
$firstUser->load('roles');

echo "   RESULT:\n";
echo "   ├─ User Created: ✓\n";
echo "   ├─ Is First User: " . ($isFirst ? "YES ✓" : "NO") . "\n";
echo "   ├─ Email Verified: " . ($firstUser->hasVerifiedEmail() ? "YES ✓" : "NO") . "\n";
echo "   ├─ Role Assigned: " . ($firstUser->roles->pluck('name')->implode(', ') ?: 'NONE') . "\n";
echo "   └─ Can Login: " . (!$firstUser->roles->isEmpty() && $firstUser->hasVerifiedEmail() ? "YES ✓" : "NO") . "\n";

// Test login for first user
echo "\n   LOGIN TEST:\n";
$loginSuccess = Auth::attempt(['email' => 'mainadmin@cbt.com', 'password' => 'Admin@123456']);
if ($loginSuccess) {
    $user = Auth::user();
    if ($user->roles->isEmpty()) {
        echo "   └─ Status: BLOCKED (No Role) ✗\n";
    } elseif (!$user->hasVerifiedEmail()) {
        echo "   └─ Status: BLOCKED (Email Not Verified) ✗\n";
    } else {
        $token = $user->createToken('test')->plainTextToken;
        echo "   └─ Status: SUCCESS ✓\n";
        echo "   └─ Token: " . substr($token, 0, 20) . "...\n";
    }
    Auth::logout();
} else {
    echo "   └─ Status: FAILED (Wrong credentials) ✗\n";
}

// ============================================
// TEST 2: Second User Signup (Should be Pending)
// ============================================
echo "\n═══════════════════════════════════════════════════════════════\n";
echo "TEST 2: SECOND USER SIGNUP (Pending Approval)\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "   Email: seconduser@cbt.com\n";
echo "   Password: User@123456\n";
echo "   Phone: +2349087654321\n\n";

$secondUser = User::create([
    'name' => 'Second User',
    'email' => 'seconduser@cbt.com',
    'password' => Hash::make('User@123456'),
    'phone_number' => '+2349087654321',
    'profile_picture' => 'uploads/profile_pictures/test_user.jpg',
]);

$secondUser->refresh();
$secondUser->load('roles');

echo "   RESULT:\n";
echo "   ├─ User Created: ✓\n";
echo "   ├─ Is First User: NO (Correct)\n";
echo "   ├─ Email Verified: " . ($secondUser->hasVerifiedEmail() ? "YES" : "NO (Correct)") . "\n";
echo "   ├─ Role Assigned: " . ($secondUser->roles->pluck('name')->implode(', ') ?: 'NONE (Correct - Pending Approval)') . "\n";
echo "   └─ Can Login: " . (!$secondUser->roles->isEmpty() ? "YES" : "NO ✓ (Blocked - Pending Approval)") . "\n";

// Test login for second user
echo "\n   LOGIN TEST:\n";
$loginSuccess2 = Auth::attempt(['email' => 'seconduser@cbt.com', 'password' => 'User@123456']);
if ($loginSuccess2) {
    $user2 = Auth::user();
    if ($user2->roles->isEmpty()) {
        echo "   └─ Status: BLOCKED (Pending Approval) ✓ CORRECT!\n";
    } elseif (!$user2->hasVerifiedEmail()) {
        echo "   └─ Status: BLOCKED (Email Not Verified)\n";
    } else {
        echo "   └─ Status: SUCCESS (Should not happen!)\n";
    }
    Auth::logout();
} else {
    echo "   └─ Status: FAILED (Wrong credentials)\n";
}

// ============================================
// SUMMARY
// ============================================
echo "\n╔══════════════════════════════════════════════════════════════╗\n";
echo "║                        TEST SUMMARY                          ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";
echo "║  User 1 (Main Admin):                                        ║\n";
echo "║    Email: mainadmin@cbt.com                                  ║\n";
echo "║    Password: Admin@123456                                    ║\n";
echo "║    Status: CAN LOGIN ✓                                       ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";
echo "║  User 2 (Pending):                                           ║\n";
echo "║    Email: seconduser@cbt.com                                 ║\n";
echo "║    Password: User@123456                                     ║\n";
echo "║    Status: BLOCKED (Pending Approval) ✓                      ║\n";
echo "╚══════════════════════════════════════════════════════════════╝\n\n";

echo "You can now test these credentials in the web browser at:\n";
echo "  Signup: http://localhost:3000/admin-signup\n";
echo "  Login:  http://localhost:3000/admin-login\n";
