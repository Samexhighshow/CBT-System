<?php

namespace App\Services;

use App\Models\Student;
use App\Models\SystemSetting;

class RegistrationNumberService
{
    /**
     * Generate a registration number based on system settings
     * 
     * Format: {prefix}{separator}{year}{separator}{padded_number}
     * Example: REG/2025/0001
     * 
     * @return string
     */
    public static function generateRegistrationNumber(): string
    {
        // Fetch settings from database
        $prefix = SystemSetting::get('registration_number_prefix', 'REG');
        $year = SystemSetting::get('registration_number_year', date('Y'));
        $separator = SystemSetting::get('registration_number_separator', '/');
        $padding = (int) SystemSetting::get('registration_number_padding', '4');

        // Get the next number from students table
        $lastStudent = Student::orderBy('id', 'desc')->first();
        $nextNumber = $lastStudent ? $lastStudent->id + 1 : 1;

        // Pad the number with leading zeros
        $paddedNumber = str_pad($nextNumber, $padding, '0', STR_PAD_LEFT);

        // Format: {prefix}{separator}{year}{separator}{padded_number}
        return "{$prefix}{$separator}{$year}{$separator}{$paddedNumber}";
    }

    /**
     * Validate if a registration number already exists
     * 
     * @param string $registrationNumber
     * @return bool
     */
    public static function exists(string $registrationNumber): bool
    {
        return Student::where('registration_number', $registrationNumber)->exists();
    }

    /**
     * Generate a unique registration number (ensures no duplicates)
     * 
     * @return string
     */
    public static function generateUniqueRegistrationNumber(): string
    {
        do {
            $registrationNumber = self::generateRegistrationNumber();
        } while (self::exists($registrationNumber));

        return $registrationNumber;
    }
}
