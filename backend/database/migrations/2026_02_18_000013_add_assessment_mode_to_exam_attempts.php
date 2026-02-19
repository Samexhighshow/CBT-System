<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_attempts', 'assessment_mode')) {
                $table->string('assessment_mode', 32)->nullable()->after('question_order');
                $table->index(['exam_id', 'student_id', 'assessment_mode'], 'exam_attempts_exam_student_mode_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (Schema::hasColumn('exam_attempts', 'assessment_mode')) {
                $table->dropIndex('exam_attempts_exam_student_mode_idx');
                $table->dropColumn('assessment_mode');
            }
        });
    }
};
