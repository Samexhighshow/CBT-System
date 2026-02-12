<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('system_settings')
            ->where('key', 'cbt_tab_fencing_max_violations')
            ->exists();

        if (!$exists) {
            DB::table('system_settings')->insert([
                'key' => 'cbt_tab_fencing_max_violations',
                'value' => '3',
                'type' => 'string',
                'description' => 'Maximum tab-fencing violations before auto-submit',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'cbt_tab_fencing_max_violations')
            ->delete();
    }
};
