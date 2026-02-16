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
            ['key' => 'cbt_tab_fencing_max_violations', 'value' => '3', 'type' => 'string', 'description' => 'Maximum tab-fencing violations before auto-submit'],
            ['key' => 'registration_number_prefix', 'value' => 'REG', 'type' => 'string', 'description' => 'Prefix for auto-generated registration numbers'],
            ['key' => 'registration_number_year', 'value' => date('Y'), 'type' => 'string', 'description' => 'Year for auto-generated registration numbers'],
            ['key' => 'registration_number_separator', 'value' => '/', 'type' => 'string', 'description' => 'Separator for registration numbers'],
            ['key' => 'registration_number_padding', 'value' => '4', 'type' => 'string', 'description' => 'Number padding for registration numbers'],
            ['key' => 'registration_number_counter', 'value' => '0', 'type' => 'string', 'description' => 'Current counter for auto-generated registration numbers'],
            ['key' => 'smtp_host', 'value' => '', 'type' => 'string', 'description' => 'SMTP host for email'],
            ['key' => 'smtp_port', 'value' => '587', 'type' => 'string', 'description' => 'SMTP port'],
            ['key' => 'smtp_user', 'value' => '', 'type' => 'string', 'description' => 'SMTP username'],
            ['key' => 'smtp_from', 'value' => '', 'type' => 'string', 'description' => 'SMTP from address'],
            [
                'key' => 'endpoint_toggles',
                'value' => '{"students":true,"exams":true,"questions":true,"academics":true,"results":true,"announcements":true,"allocations":true,"admin_users_roles":true}',
                'type' => 'json',
                'description' => 'Enable/disable API endpoint modules from admin settings',
            ],
            ['key' => 'grading_scheme', 'value' => 'waec', 'type' => 'string', 'description' => 'Grading scheme: waec, letter, or position'],
            [
                'key' => 'grading_scale_waec',
                'value' => '[{"grade":"A1","min":75},{"grade":"B2","min":70},{"grade":"B3","min":65},{"grade":"C4","min":60},{"grade":"C5","min":55},{"grade":"C6","min":50},{"grade":"D7","min":45},{"grade":"E8","min":40},{"grade":"F9","min":0}]',
                'type' => 'json',
                'description' => 'WAEC-style grading thresholds',
            ],
            [
                'key' => 'grading_scale_letter',
                'value' => '[{"grade":"A","min":70},{"grade":"B","min":60},{"grade":"C","min":50},{"grade":"D","min":45},{"grade":"E","min":40},{"grade":"F","min":0}]',
                'type' => 'json',
                'description' => 'Letter grading thresholds',
            ],
            [
                'key' => 'position_grading_scale',
                'value' => '[{"label":"1st","min":70},{"label":"2nd","min":60},{"label":"3rd","min":50},{"label":"Pass","min":40},{"label":"Fail","min":0}]',
                'type' => 'json',
                'description' => 'Position grading thresholds by percentage',
            ],
            ['key' => 'pass_mark_percentage', 'value' => '50', 'type' => 'string', 'description' => 'Default pass mark percentage when exam pass mark is not set'],
            ['key' => 'current_academic_session', 'value' => date('Y') . '/' . (date('Y') + 1), 'type' => 'string', 'description' => 'Current academic session used for exam defaults and result compilation'],
            ['key' => 'current_term', 'value' => 'First Term', 'type' => 'string', 'description' => 'Current academic term for exam defaults'],
            ['key' => 'enable_term_result_compilation', 'value' => '1', 'type' => 'boolean', 'description' => 'Enable combining CA and Exam components into a term score'],
            ['key' => 'enable_cumulative_results', 'value' => '1', 'type' => 'boolean', 'description' => 'Enable cumulative result (CR) averaging across terms'],
            ['key' => 'default_ca_weight', 'value' => '40', 'type' => 'string', 'description' => 'Default CA percentage weight when exam assessment weight is not set'],
            ['key' => 'default_exam_weight', 'value' => '60', 'type' => 'string', 'description' => 'Default exam percentage weight when exam assessment weight is not set'],
            ['key' => 'use_exam_assessment_weight', 'value' => '1', 'type' => 'boolean', 'description' => 'Use per-exam assessment_weight when available for term compilation'],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
