<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $defaults = [
            [
                'key' => 'current_academic_session',
                'value' => date('Y') . '/' . (date('Y') + 1),
                'type' => 'string',
                'description' => 'Current academic session used for exam defaults and result compilation',
            ],
            [
                'key' => 'current_term',
                'value' => 'First Term',
                'type' => 'string',
                'description' => 'Current academic term for exam defaults',
            ],
            [
                'key' => 'enable_term_result_compilation',
                'value' => true,
                'type' => 'boolean',
                'description' => 'Enable combining CA and Exam components into a term score',
            ],
            [
                'key' => 'enable_cumulative_results',
                'value' => true,
                'type' => 'boolean',
                'description' => 'Enable cumulative result (CR) averaging across terms',
            ],
            [
                'key' => 'default_ca_weight',
                'value' => '40',
                'type' => 'string',
                'description' => 'Default CA percentage weight when exam assessment weight is not set',
            ],
            [
                'key' => 'default_exam_weight',
                'value' => '60',
                'type' => 'string',
                'description' => 'Default Exam percentage weight when exam assessment weight is not set',
            ],
            [
                'key' => 'use_exam_assessment_weight',
                'value' => true,
                'type' => 'boolean',
                'description' => 'Use per-exam assessment_weight when available for term compilation',
            ],
        ];

        foreach ($defaults as $item) {
            SystemSetting::updateOrCreate(
                ['key' => $item['key']],
                [
                    'value' => $item['value'],
                    'type' => $item['type'],
                    'description' => $item['description'],
                ]
            );
        }
    }

    public function down(): void
    {
        SystemSetting::whereIn('key', [
            'current_academic_session',
            'current_term',
            'enable_term_result_compilation',
            'enable_cumulative_results',
            'default_ca_weight',
            'default_exam_weight',
            'use_exam_assessment_weight',
        ])->delete();
    }
};
