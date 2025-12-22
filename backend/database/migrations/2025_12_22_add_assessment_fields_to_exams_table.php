<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds assessment structure to exams for proper result management:
     * - assessment_type: categorizes exam (CA Test, Midterm, Final Exam, Quiz)
     * - assessment_weight: optional hint for result calculation (e.g., CA=40, Final=60)
     */
    public function up(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            // Assessment Type - required for result management
            $table->enum('assessment_type', ['CA Test', 'Midterm Test', 'Final Exam', 'Quiz'])
                  ->after('duration_minutes')
                  ->nullable()
                  ->comment('Type of assessment for result calculation');
            
            // Assessment Weight - optional hint for scoring (not calculated here)
            $table->integer('assessment_weight')
                  ->after('assessment_type')
                  ->nullable()
                  ->comment('Weight/percentage for this assessment (e.g., 40 for CA, 60 for Final)');
            
            // Index for filtering and grouping exams by assessment type
            $table->index('assessment_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropIndex(['assessment_type']);
            $table->dropColumn(['assessment_type', 'assessment_weight']);
        });
    }
};
