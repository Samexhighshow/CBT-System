<?php

namespace App\Services;

use App\Models\User;

class OfflineLoginService
{
    /**
     * Verify an offline PIN for a user.
     */
    public static function verifyPin(User $user, string $pin): bool
    {
        if (!$user->offline_login_enabled || !$user->offline_pin_hash) {
            return false;
        }

        $pinHash = hash('sha256', $pin);
        return hash_equals($user->offline_pin_hash, $pinHash);
    }

    /**
     * Set offline PIN for a user.
     */
    public static function setPin(User $user, string $pin): void
    {
        if (strlen($pin) < 4) {
            throw new \InvalidArgumentException('PIN must be at least 4 digits long');
        }

        $pinHash = hash('sha256', $pin);
        $user->update([
            'offline_login_enabled' => true,
            'offline_pin_hash' => $pinHash,
        ]);
    }

    /**
     * Disable offline login for a user.
     */
    public static function disableOfflineLogin(User $user): void
    {
        $user->update([
            'offline_login_enabled' => false,
            'offline_pin_hash' => null,
        ]);
    }
}
