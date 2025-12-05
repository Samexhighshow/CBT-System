<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if settings table exists, if not create it
        if (!Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        // Add registration number settings
        $settings = [
            ['key' => 'registration_number_prefix', 'value' => 'REG'],
            ['key' => 'registration_number_year', 'value' => date('Y')],
            ['key' => 'registration_number_separator', 'value' => '/'],
            ['key' => 'registration_number_padding', 'value' => '4'],
            ['key' => 'registration_number_auto_generate', 'value' => 'true'],
        ];

        foreach ($settings as $setting) {
            DB::table('settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'registration_number_prefix',
            'registration_number_year',
            'registration_number_separator',
            'registration_number_padding',
            'registration_number_auto_generate',
        ])->delete();
    }
};
