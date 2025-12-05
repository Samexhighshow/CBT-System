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
            ['key' => 'allow_new_registration', 'value' => '1', 'type' => 'boolean', 'description' => 'Allow new registrations (alias)'],
            ['key' => 'exam_window_start', 'value' => '08:00', 'type' => 'string', 'description' => 'Daily exam window start time (HH:MM)'],
            ['key' => 'exam_window_end', 'value' => '17:00', 'type' => 'string', 'description' => 'Daily exam window end time (HH:MM)'],
            ['key' => 'max_exam_attempts', 'value' => '3', 'type' => 'string', 'description' => 'Maximum exam attempts per student'],
            ['key' => 'auto_logout_minutes', 'value' => '60', 'type' => 'string', 'description' => 'Auto logout after inactivity (minutes)'],
            ['key' => 'require_email_verification', 'value' => '1', 'type' => 'boolean', 'description' => 'Require email verification for new accounts'],
            ['key' => 'dark_mode', 'value' => '0', 'type' => 'boolean', 'description' => 'Enable dark mode by default'],
            ['key' => 'system_name', 'value' => 'CBT System', 'type' => 'string', 'description' => 'System name displayed in UI'],
            ['key' => 'allow_exam_retakes', 'value' => '0', 'type' => 'boolean', 'description' => 'Allow students to retake exams'],
            ['key' => 'registration_number_prefix', 'value' => 'REG', 'type' => 'string', 'description' => 'Prefix for auto-generated registration numbers'],
            ['key' => 'registration_number_year', 'value' => date('Y'), 'type' => 'string', 'description' => 'Year for auto-generated registration numbers'],
            ['key' => 'registration_number_separator', 'value' => '/', 'type' => 'string', 'description' => 'Separator for registration numbers'],
            ['key' => 'registration_number_padding', 'value' => '4', 'type' => 'string', 'description' => 'Number padding for registration numbers'],
            ['key' => 'registration_number_counter', 'value' => '0', 'type' => 'string', 'description' => 'Current counter for auto-generated registration numbers'],
            ['key' => 'smtp_host', 'value' => '', 'type' => 'string', 'description' => 'SMTP host for email'],
            ['key' => 'smtp_port', 'value' => '587', 'type' => 'string', 'description' => 'SMTP port'],
            ['key' => 'smtp_user', 'value' => '', 'type' => 'string', 'description' => 'SMTP username'],
            ['key' => 'smtp_from', 'value' => '', 'type' => 'string', 'description' => 'SMTP from address'],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
