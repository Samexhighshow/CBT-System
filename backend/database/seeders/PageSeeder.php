<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use App\Models\Page;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PageSeeder extends Seeder
{
    public function run()
    {
        // Navigation pages matching adminNav.ts
        $pages = [
            ['name' => 'Overview', 'path' => '/admin', 'category' => 'Dashboard'],
            ['name' => 'Questions', 'path' => '/admin/questions', 'category' => 'Content'],
            ['name' => 'Exams', 'path' => '/admin/exams', 'category' => 'Exams'],
            ['name' => 'Exam Access', 'path' => '/admin/exam-access', 'category' => 'Exams'],
            ['name' => 'Students', 'path' => '/admin/students', 'category' => 'Management'],
            ['name' => 'Academic Management', 'path' => '/admin/subjects', 'category' => 'Management'],
            ['name' => 'Announcements', 'path' => '/admin/announcements', 'category' => 'Communication'],
            ['name' => 'View Allocations', 'path' => '/admin/allocations', 'category' => 'Allocation'],
            ['name' => 'Generate Allocation', 'path' => '/admin/allocations/generate', 'category' => 'Allocation'],
            ['name' => 'Teacher Assignment', 'path' => '/admin/teachers/assign', 'category' => 'Allocation'],
            ['name' => 'Halls', 'path' => '/admin/halls', 'category' => 'Allocation'],
            ['name' => 'Allocation System', 'path' => '/admin/allocations', 'category' => 'Allocation'],
            ['name' => 'Results', 'path' => '/admin/results', 'category' => 'Analytics'],
            ['name' => 'Users', 'path' => '/admin/users', 'category' => 'Admin'],
            ['name' => 'System Settings', 'path' => '/admin/system-settings', 'category' => 'Admin'],
            ['name' => 'Activity Logs', 'path' => '/admin/activity-logs', 'category' => 'Admin'],
            ['name' => 'Roles', 'path' => '/admin/roles', 'category' => 'Admin'],
        ];

        $pagesByName = [];
        
        foreach ($pages as $pageData) {
            $slug = Str::slug($pageData['path'], '-');
            $permissionName = 'access:' . $slug;

            $page = Page::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $pageData['name'],
                    'path' => $pageData['path'],
                    'category' => $pageData['category'],
                    'permission_name' => $permissionName,
                    'is_active' => true,
                ]
            );

            Permission::firstOrCreate(['name' => $permissionName]);
            $pagesByName[$page->name] = $permissionName;
        }

        // Assign permissions to roles
        $mainAdminOnlyPages = ['System Settings', 'Activity Logs', 'Users', 'Roles'];

        $rolePermissions = [
            'Main Admin' => array_values($pagesByName), // Main Admin gets ALL
            'Admin' => array_values(array_filter($pagesByName, function($name) {
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

        foreach ($rolePermissions as $roleName => $permissions) {
            $role = Role::where('name', $roleName)->first();
            if (!$role) continue;

            try {
                $existingPermissions = $role->permissions()->pluck('name');
                $nonPagePermissions = $existingPermissions->filter(fn ($name) => !str_starts_with($name, 'access:'));
                $role->syncPermissions($nonPagePermissions->merge($permissions));
            } catch (\Exception $e) {
                foreach ($permissions as $permission) {
                    try {
                        $role->givePermissionTo($permission);
                    } catch (\Exception $ex) {
                        // Skip if already assigned
                    }
                }
            }
        }
    }
}
