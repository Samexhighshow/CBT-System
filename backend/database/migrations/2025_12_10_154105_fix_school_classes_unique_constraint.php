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
        // Drop all old unique constraints on name only
        try {
            DB::statement('ALTER TABLE school_classes DROP INDEX classes_name_unique');
        } catch (\Exception $e) {
            // Constraint might not exist
        }
        
        try {
            DB::statement('ALTER TABLE school_classes DROP INDEX school_classes_name_unique');
        } catch (\Exception $e) {
            // Constraint might not exist
        }
        
        // Note: composite constraint school_classes_name_department_unique already exists
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropUnique('school_classes_name_department_unique');
            $table->unique('name', 'school_classes_name_unique');
        });
    }
};
