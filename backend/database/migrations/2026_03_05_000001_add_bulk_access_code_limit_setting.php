<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
  public function up(): void
  {
    $setting = [
      'key' => 'bulk_access_code_limit',
      'value' => '2000',
      'type' => 'string',
      'description' => 'Maximum number of access codes that can be generated in bulk at once',
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
    DB::table('system_settings')->where('key', 'bulk_access_code_limit')->delete();
  }
};
