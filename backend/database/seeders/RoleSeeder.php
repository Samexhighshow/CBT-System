<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RoleSeeder extends Seeder
{
    public function run()
    {
        // Create permissions
        $permissions = [
            'manage_users',
            'manage_roles',
            'manage_subjects',
            'manage_departments',
            'manage_exams',
            'create_questions',
            'manage_registration',
            'release_results',
            'export_reports',
            'view_analytics',
            'monitor_exams',
            'force_submit'
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Create roles
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $adminRole->syncPermissions($permissions);

        $subAdminRole = Role::firstOrCreate(['name' => 'Sub-Admin']);
        $subAdminRole->syncPermissions([
            'manage_exams',
            'create_questions',
            'manage_registration',
            'view_analytics'
        ]);

        $moderatorRole = Role::firstOrCreate(['name' => 'Moderator']);
        $moderatorRole->syncPermissions([
            'monitor_exams',
            'view_analytics',
            'force_submit'
        ]);

        $teacherRole = Role::firstOrCreate(['name' => 'Teacher']);
        $teacherRole->syncPermissions([
            'create_questions',
            'view_analytics'
        ]);

        // Note: Student role is not created here as students are managed separately
        // through the student registration system

        // Ensure a Main Admin role exists and is assigned to first user without a role
        $mainAdminRole = Role::firstOrCreate(['name' => 'Main Admin']);

        $firstUser = User::orderBy('id','asc')->first();
        if ($firstUser && !$firstUser->hasAnyRole(['Admin','Sub-Admin','Moderator','Teacher','Main Admin'])) {
            $firstUser->assignRole($mainAdminRole);
        }
    }
}
