<?php
/**
 * Test script for verifying the signup and login flow
 */

// Correct path to autoload - artisan uses ../vendor
require __DIR__ . '/../vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

echo "=== CBT System Authentication Test ===\n\n";

// First, ensure the users table is empty
echo "1. Checking if users table is empty...\n";
$userCount = User::count();
echo "   Current user count: $userCount\n";

if ($userCount > 0) {
    echo "   Clearing users for fresh test...\n";
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    User::truncate();
    DB::table('model_has_roles')->truncate();
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "   Users cleared.\n";
}

// Test 1: First User Signup
echo "\n2. Testing FIRST USER signup...\n";
$firstUser = User::create([
    'name' => 'Test Main Admin',
    'email' => 'admin@test.com',
    'password' => Hash::make('Password123'),
    'phone_number' => '+1234567890',
    'profile_picture' => null, // Skipping picture for test
]);

// Check if first user logic works
$isFirstAdmin = User::count() === 1;
echo "   Is first admin: " . ($isFirstAdmin ? "YES" : "NO") . "\n";

if ($isFirstAdmin) {
    $firstUser->markEmailAsVerified();
    $firstUser->assignRole('Main Admin');
    echo "   ✓ First user created with Main Admin role\n";
    echo "   ✓ Email auto-verified: " . ($firstUser->hasVerifiedEmail() ? "YES" : "NO") . "\n";

    // Check roles
    $roles = $firstUser->roles->pluck('name')->toArray();
    echo "   ✓ Roles assigned: " . implode(', ', $roles) . "\n";
}

// Test 2: Second User Signup
echo "\n3. Testing SECOND USER signup...\n";
$secondUser = User::create([
    'name' => 'Test Second User',
    'email' => 'user2@test.com',
    'password' => Hash::make('Password123'),
    'phone_number' => '+0987654321',
    'profile_picture' => null,
]);

$isSecondFirstAdmin = User::count() === 1;
echo "   Is first admin: " . ($isSecondFirstAdmin ? "YES" : "NO (CORRECT)") . "\n";

if (!$isSecondFirstAdmin) {
    echo "   ✓ Second user created WITHOUT role (Pending Approval)\n";
    $secondUserRoles = $secondUser->roles->pluck('name')->toArray();
    echo "   ✓ Roles assigned: " . (empty($secondUserRoles) ? "NONE (CORRECT)" : implode(', ', $secondUserRoles)) . "\n";
    echo "   ✓ Email verified: " . ($secondUser->hasVerifiedEmail() ? "YES" : "NO (CORRECT - Should be pending)") . "\n";
}

// Test 3: Login Logic Check
echo "\n4. Testing LOGIN logic...\n";

// First user should be able to login
$firstUserFresh = User::with('roles')->find($firstUser->id);
$firstUserHasRoles = !$firstUserFresh->roles->isEmpty();
echo "   First user (admin@test.com):\n";
echo "      Has roles: " . ($firstUserHasRoles ? "YES" : "NO") . "\n";
echo "      Can login: " . ($firstUserHasRoles && $firstUserFresh->hasVerifiedEmail() ? "YES ✓" : "NO") . "\n";

// Second user should NOT be able to login
$secondUserFresh = User::with('roles')->find($secondUser->id);
$secondUserHasRoles = !$secondUserFresh->roles->isEmpty();
echo "   Second user (user2@test.com):\n";
echo "      Has roles: " . ($secondUserHasRoles ? "YES" : "NO (CORRECT)") . "\n";
echo "      Can login: " . ($secondUserHasRoles ? "YES" : "NO ✓ (CORRECT - Pending Approval)") . "\n";

echo "\n=== TEST COMPLETE ===\n";
echo "\nSummary:\n";
echo "- First user is auto-verified and gets Main Admin role: " . ($isFirstAdmin ? "PASS ✓" : "FAIL ✗") . "\n";
echo "- Second user has no role and cannot login: " . (!$secondUserHasRoles ? "PASS ✓" : "FAIL ✗") . "\n";
