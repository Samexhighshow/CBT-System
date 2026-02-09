<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('school_classes') && Schema::hasTable('classes')) {
            Schema::rename('classes', 'school_classes');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('classes') && Schema::hasTable('school_classes')) {
            Schema::rename('school_classes', 'classes');
        }
    }
};
