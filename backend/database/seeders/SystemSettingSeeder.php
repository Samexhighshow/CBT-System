<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SystemSetting;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'student_registration_open', 'value' => '1', 'type' => 'boolean', 'description' => 'Allow new student registrations'],
            ['key' => 'exam_window_start', 'value' => '08:00', 'type' => 'string', 'description' => 'Daily exam window start time (HH:MM)'],
            ['key' => 'exam_window_end', 'value' => '17:00', 'type' => 'string', 'description' => 'Daily exam window end time (HH:MM)'],
            ['key' => 'max_exam_attempts', 'value' => '3', 'type' => 'string', 'description' => 'Maximum exam attempts per student'],
            ['key' => 'auto_logout_minutes', 'value' => '60', 'type' => 'string', 'description' => 'Auto logout after inactivity (minutes)'],
            ['key' => 'require_email_verification', 'value' => '1', 'type' => 'boolean', 'description' => 'Require email verification for new accounts'],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
