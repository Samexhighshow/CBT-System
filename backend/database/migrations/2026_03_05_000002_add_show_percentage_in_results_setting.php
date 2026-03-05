<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
  public function up(): void
  {
    $setting = [
      'key' => 'show_percentage_in_results',
      'value' => false,
      'type' => 'boolean',
      'description' => 'Show percentage alongside grade in student results (e.g., A1 85%)',
    ];

    DB::table('system_settings')->updateOrInsert(
      ['key' => $setting['key']],
      array_merge($setting, [
        'updated_at' => now(),
        'created_at' => now(),
      ])
    );
  }

  public function down(): void
  {
    DB::table('system_settings')->where('key', 'show_percentage_in_results')->delete();
  }
};
