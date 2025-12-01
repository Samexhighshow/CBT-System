<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class CreateAdminUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:create {email} {password} {name?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create an admin user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');
        $password = $this->argument('password');
        $name = $this->argument('name') ?? 'Admin User';

        // Check if user already exists
        $existingUser = User::where('email', $email)->first();
        
        if ($existingUser) {
            // Update existing user's password
            $existingUser->password = Hash::make($password);
            $existingUser->name = $name;
            $existingUser->save();
            
            // Ensure Admin role
            if (!$existingUser->hasRole('Admin')) {
                $existingUser->assignRole('Admin');
            }
            
            $this->info("User updated successfully!");
            $this->info("Email: {$email}");
            $this->info("Password has been reset");
            return 0;
        }

        // Create new user
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'email_verified_at' => now(),
        ]);

        // Ensure Admin role exists
        $adminRole = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'web']);
        
        // Assign Admin role
        $user->assignRole($adminRole);

        $this->info("Admin user created successfully!");
        $this->info("Email: {$email}");
        $this->info("Name: {$name}");
        
        return 0;
    }
}
