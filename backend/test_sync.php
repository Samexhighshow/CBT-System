<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Page;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

echo "=== TESTING SYNC NAVIGATION MODULE ===\n\n";

// Check roles before sync
echo "1. ROLES BEFORE SYNC:\n";
$roles = Role::with('permissions')->get();
foreach ($roles as $role) {
    $permissions = $role->permissions->filter(fn($p) => str_starts_with($p->name, 'access:'));
    echo "   {$role->name} (ID: {$role->id}): " . $permissions->count() . " page permissions\n";
    if ($permissions->count() > 0) {
        echo "      -> " . $permissions->pluck('name')->implode(', ') . "\n";
    }
}

// Check pages before sync
echo "\n2. PAGES IN DATABASE BEFORE SYNC:\n";
$pageCount = Page::count();
echo "   Total pages: {$pageCount}\n";
if ($pageCount > 0) {
    $pages = Page::orderBy('name')->get(['name', 'path', 'permission_name']);
    foreach ($pages as $page) {
        echo "   - {$page->name} ({$page->path}) -> {$page->permission_name}\n";
    }
}

// Simulate sync - Create test pages
echo "\n3. SIMULATING SYNC (Creating sample navigation pages)...\n";
$navPages = [
    ['name' => 'Overview', 'path' => '/admin', 'category' => null],
    ['name' => 'Questions', 'path' => '/admin/questions', 'category' => null],
    ['name' => 'Exams', 'path' => '/admin/exams', 'category' => null],
    ['name' => 'Exam Access', 'path' => '/admin/exam-access', 'category' => null],
    ['name' => 'Students', 'path' => '/admin/students', 'category' => null],
    ['name' => 'Academic Management', 'path' => '/admin/subjects', 'category' => null],
    ['name' => 'Announcements', 'path' => '/admin/announcements', 'category' => null],
    ['name' => 'Allocation System', 'path' => '/admin/allocations', 'category' => null],
    ['name' => 'View Allocations', 'path' => '/admin/allocations', 'category' => 'Allocation System'],
    ['name' => 'Generate Allocation', 'path' => '/admin/allocations/generate', 'category' => 'Allocation System'],
    ['name' => 'Teacher Assignment', 'path' => '/admin/teachers/assign', 'category' => 'Allocation System'],
    ['name' => 'Halls', 'path' => '/admin/halls', 'category' => 'Allocation System'],
    ['name' => 'Results', 'path' => '/admin/results', 'category' => null],
    ['name' => 'System Settings', 'path' => '/admin/settings', 'category' => null],
    ['name' => 'Activity Logs', 'path' => '/admin/activity-logs', 'category' => null],
];

$synced = [];
$allPermissions = [];

foreach ($navPages as $pageData) {
    $slug = Str::slug($pageData['path'], '-');
    $permissionName = 'access:' . $slug;

    $page = Page::updateOrCreate(
        ['slug' => $slug],
        [
            'name' => $pageData['name'],
            'path' => $pageData['path'],
            'category' => $pageData['category'] ?? null,
            'permission_name' => $permissionName,
            'is_active' => true,
        ]
    );

    Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => 'web']);
    $allPermissions[] = $permissionName;
    $synced[] = $page;
    echo "   ✓ Created/Updated: {$page->name} -> {$permissionName}\n";
}

// Assign default permissions
echo "\n4. ASSIGNING DEFAULT PERMISSIONS TO ROLES:\n";

$pagesByName = [];
foreach ($synced as $page) {
    $pagesByName[$page->name] = $page->permission_name;
}

// Pages exclusive to Main Admin only
$mainAdminOnlyPages = ['System Settings', 'Activity Logs', 'Users', 'Roles'];

$roleDefaults = [
    'Main Admin' => $allPermissions,
    'Admin' => array_values(array_filter($pagesByName, function($name) {
        // Admin gets everything except Main Admin exclusive pages
        $excluded = ['System Settings', 'Activity Logs', 'Users', 'Roles'];
        return !in_array($name, $excluded);
    }, ARRAY_FILTER_USE_KEY)),
    'Sub-Admin' => array_values(array_intersect_key($pagesByName, array_flip([
        'Overview', 'Questions', 'Exams', 'Exam Access', 'Students', 'Results', 
        'Academic Management', 'Announcements', 'Allocation System', 'View Allocations', 
        'Generate Allocation', 'Teacher Assignment', 'Halls'
    ]))),
    'Moderator' => array_values(array_intersect_key($pagesByName, array_flip([
        'Overview', 'Exams', 'Exam Access', 'Students', 'Results'
    ]))),
    'Teacher' => array_values(array_intersect_key($pagesByName, array_flip([
        'Overview', 'Questions', 'Results'
    ]))),
];

foreach ($roleDefaults as $roleName => $permissions) {
    $role = Role::where('name', $roleName)->first();
    if (!$role) {
        echo "   ⚠ Role '{$roleName}' not found, skipping...\n";
        continue;
    }

    try {
        $existingPermissions = $role->permissions()->pluck('name');
        $nonPagePermissions = $existingPermissions->filter(fn ($name) => !str_starts_with($name, 'access:'));
        $role->syncPermissions($nonPagePermissions->merge($permissions));
        echo "   ✓ {$roleName}: Assigned " . count($permissions) . " permissions\n";
    } catch (\Exception $e) {
        echo "   ✗ {$roleName}: Error - " . $e->getMessage() . "\n";
    }
}

// Check roles after sync
echo "\n5. ROLES AFTER SYNC:\n";
$roles = Role::with('permissions')->get();
foreach ($roles as $role) {
    $permissions = $role->permissions->filter(fn($p) => str_starts_with($p->name, 'access:'));
    echo "   {$role->name} (ID: {$role->id}): " . $permissions->count() . " page permissions\n";
    if ($permissions->count() > 0) {
        // Map permission names back to page names
        $pageNames = [];
        foreach ($permissions as $perm) {
            $page = Page::where('permission_name', $perm->name)->first();
            if ($page) {
                $pageNames[] = $page->name;
            }
        }
        echo "      -> " . implode(', ', $pageNames) . "\n";
    }
}

echo "\n=== TEST COMPLETE ===\n";
