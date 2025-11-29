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
        // Add subject_group and class_level columns to subjects table
        Schema::table('subjects', function (Blueprint $table) {
            $table->enum('subject_group', ['compulsory', 'trade', 'elective'])->default('compulsory')->after('name');
            $table->json('class_levels')->nullable()->after('subject_group'); // ["JSS1","JSS2"...] or ["SSS1","SSS2"...]
            $table->json('departments')->nullable()->after('class_levels'); // [1,2,3] department IDs for SSS
        });

        // Create student_subjects pivot table
        Schema::create('student_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->foreignId('subject_id')->constrained('subjects')->onDelete('cascade');
            $table->timestamps();
            
            $table->unique(['student_id', 'subject_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_subjects');
        
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn(['subject_group', 'class_levels', 'departments']);
        });
    }
};
