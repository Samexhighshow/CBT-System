<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class SetOfflinePin extends Command
{
    protected $signature = 'offline:set-pin {email} {--pin=}';
    protected $description = 'Set offline PIN hash for a user (for offline admin/teacher login)';

    public function handle(): int
    {
        $email = $this->argument('email');
        $pin = $this->option('pin') ?? $this->secret('Enter offline PIN (min 4 digits)');

        if (strlen($pin) < 4) {
            $this->error('PIN must be at least 4 digits long');
            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (!$user) {
            $this->error("User not found: {$email}");
            return self::FAILURE;
        }

        $pinHash = hash('sha256', $pin);

        $user->update([
            'offline_login_enabled' => true,
            'offline_pin_hash' => $pinHash,
        ]);

        $this->info("✓ Offline PIN set for {$email}");
        $this->line("PIN Hash: {$pinHash}");
        $this->warn('PIN is hashed with SHA-256 for security.');

        return self::SUCCESS;
    }
}
