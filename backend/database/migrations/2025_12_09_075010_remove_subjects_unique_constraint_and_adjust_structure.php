<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            // Drop the old unique constraint on name and class_level
            $table->dropUnique(['name', 'class_level']);
            
            // Add new unique constraint: name + class_id + department_id
            // This ensures no duplicate subjects for the same class/department combination
            $table->unique(['name', 'class_id', 'department_id'], 'subjects_name_class_dept_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropUnique('subjects_name_class_dept_unique');
            $table->unique(['name', 'class_level']);
        });
    }
};
