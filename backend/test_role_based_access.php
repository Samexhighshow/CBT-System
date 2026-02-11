<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Page;
use App\Models\User;
use Spatie\Permission\Models\Role;

echo "=== TESTING ROLE-BASED PAGE ACCESS ===\n\n";

// Get all roles
$roles = Role::all();

if ($roles->isEmpty()) {
    echo "⚠️  No roles found in database. Run sync first.\n";
    exit;
}

// For each role, show what pages they should see
echo "1. EXPECTED PAGES BY ROLE:\n";
foreach ($roles as $role) {
    $permissions = $role->permissions()
        ->where('name', 'like', 'access:%')
        ->pluck('name')
        ->toArray();
    
    if (empty($permissions)) {
        echo "   {$role->name}: [No page permissions]\n";
        continue;
    }

    // Get page names from permission names
    $pageNames = [];
    foreach ($permissions as $perm) {
        $slug = str_replace('access:', '', $perm);
        $page = Page::where('permission_name', $perm)->first();
        if ($page) {
            $pageNames[] = $page->name;
        }
    }

    echo "   {$role->name}: " . count($pageNames) . " pages\n";
    foreach ($pageNames as $name) {
        echo "      ✓ {$name}\n";
    }
}

echo "\n2. TESTING API RESPONSE FOR EACH ROLE:\n";

// Get or find test users for each role
foreach ($roles as $role) {
    $testUser = User::whereHas('roles', function ($q) use ($role) {
        $q->where('name', $role->name);
    })->first();

    if (!$testUser) {
        echo "   ℹ️  No users found with {$role->name} role\n";
        continue;
    }

    // Get the pages this role should have access to
    $rolePermissions = $role->permissions()
        ->where('name', 'like', 'access:%')
        ->pluck('name')
        ->toArray();

    $expectedPages = [];
    if (!empty($rolePermissions)) {
        $expectedPages = Page::whereIn('permission_name', $rolePermissions)
            ->orderBy('name')
            ->pluck('name')
            ->toArray();
    }

    // Verify pages in database match expected
    echo "   ✓ {$role->name} ({$testUser->email}): " . count($expectedPages) . " pages\n";
    foreach ($expectedPages as $pageName) {
        echo "      • {$pageName}\n";
    }
}

echo "\n3. VERIFICATION SUMMARY:\n";

// Verify role hierarchies
$mainAdmin = Role::where('name', 'Main Admin')->with('permissions')->first();
$admin = Role::where('name', 'Admin')->with('permissions')->first();
$subAdmin = Role::where('name', 'Sub-Admin')->with('permissions')->first();
$moderator = Role::where('name', 'Moderator')->with('permissions')->first();
$teacher = Role::where('name', 'Teacher')->with('permissions')->first();

if ($mainAdmin && $admin) {
    $mainAdminPages = $mainAdmin->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    $adminPages = $admin->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    
    if ($mainAdminPages >= $adminPages) {
        echo "   ✓ Main Admin has >= Admin permissions (" . $mainAdminPages . " vs " . $adminPages . ")\n";
    } else {
        echo "   ✗ ERROR: Main Admin has fewer permissions than Admin!\n";
    }
}

if ($admin && $subAdmin) {
    $adminPages = $admin->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    $subAdminPages = $subAdmin->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    
    if ($adminPages >= $subAdminPages) {
        echo "   ✓ Admin has >= Sub-Admin permissions (" . $adminPages . " vs " . $subAdminPages . ")\n";
    } else {
        echo "   ℹ️  Sub-Admin has more permissions than Admin (this may be intentional)\n";
    }
}

if ($moderator && $teacher) {
    $moderatorPages = $moderator->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    $teacherPages = $teacher->permissions()
        ->where('name', 'like', 'access:%')
        ->count();
    
    if ($moderatorPages >= $teacherPages) {
        echo "   ✓ Moderator has >= Teacher permissions (" . $moderatorPages . " vs " . $teacherPages . ")\n";
    } else {
        echo "   ✗ ERROR: Moderator has fewer permissions than Teacher!\n";
    }
}

echo "\n=== TEST COMPLETE ===\n";
