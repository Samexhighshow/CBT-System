<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('exams') && Schema::hasColumn('exams', 'status')) {
            DB::statement("ALTER TABLE exams MODIFY status ENUM('draft','scheduled','active','completed','cancelled','closed') DEFAULT 'draft'");
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exams') && Schema::hasColumn('exams', 'status')) {
            DB::statement("ALTER TABLE exams MODIFY status ENUM('draft','scheduled','active','completed','cancelled') DEFAULT 'draft'");
        }
    }
};
