<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['key' => 'assessment_display_mode'],
            [
                'value' => 'auto',
                'type' => 'string',
                'description' => 'Assessment display mode label: auto, exam or ca_test',
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'assessment_display_mode')
            ->delete();
    }
};
