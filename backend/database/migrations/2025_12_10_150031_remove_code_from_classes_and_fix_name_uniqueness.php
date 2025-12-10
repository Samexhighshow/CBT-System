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
        Schema::table('school_classes', function (Blueprint $table) {
            // Drop code column if it exists
            if (Schema::hasColumn('school_classes', 'code')) {
                $table->dropColumn('code');
            }
        });
        
        // Drop unique constraint on name using raw SQL if it exists
        Schema::table('school_classes', function (Blueprint $table) {
            try {
                DB::statement('ALTER TABLE school_classes DROP INDEX school_classes_name_unique');
            } catch (\Exception $e) {
                // Index might not exist, continue
            }
            
            // Add composite unique constraint: name + department_id
            $table->unique(['name', 'department_id'], 'school_classes_name_department_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('school_classes', function (Blueprint $table) {
            // Reverse: drop composite unique
            $table->dropUnique('school_classes_name_department_unique');
            
            // Add back individual name unique
            $table->unique('name', 'school_classes_name_unique');
            
            // Add back code column
            if (!Schema::hasColumn('school_classes', 'code')) {
                $table->string('code')->nullable()->after('name');
            }
        });
    }
};
