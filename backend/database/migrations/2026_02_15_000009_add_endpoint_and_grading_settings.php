<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'endpoint_toggles',
                'value' => '{"students":true,"exams":true,"questions":true,"academics":true,"results":true,"announcements":true,"allocations":true,"admin_users_roles":true}',
                'type' => 'json',
                'description' => 'Enable/disable API endpoint modules from admin settings',
            ],
            [
                'key' => 'grading_scheme',
                'value' => 'waec',
                'type' => 'string',
                'description' => 'Grading scheme: waec, letter, or position',
            ],
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
            [
                'key' => 'pass_mark_percentage',
                'value' => '50',
                'type' => 'string',
                'description' => 'Default pass mark percentage when exam pass mark is not set',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, [
                    'updated_at' => now(),
                    'created_at' => now(),
                ])
            );
        }
    }

    public function down(): void
    {
        DB::table('system_settings')->whereIn('key', [
            'endpoint_toggles',
            'grading_scheme',
            'grading_scale_waec',
            'grading_scale_letter',
            'position_grading_scale',
            'pass_mark_percentage',
        ])->delete();
    }
};
