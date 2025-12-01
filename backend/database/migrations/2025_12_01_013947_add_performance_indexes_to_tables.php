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
        // Add indexes to students table
        Schema::table('students', function (Blueprint $table) {
            $table->index('student_id');
            $table->index('class_level');
            $table->index('department');
            $table->index('is_active');
        });

        // Add indexes to exams table
        Schema::table('exams', function (Blueprint $table) {
            $table->index('class_level');
            $table->index('department');
            $table->index('published');
        });

        // Add indexes to exam_attempts table
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->index('status');
            $table->index('started_at');
            $table->index('ended_at');
        });

        // Add indexes to exam_questions table
        Schema::table('exam_questions', function (Blueprint $table) {
            $table->index('question_type');
        });

        // Add index to cbt_questions table (already has subject_id index from creation)
        Schema::table('cbt_questions', function (Blueprint $table) {
            $table->index('question_type');
        });

        // cbt_student_exams already has indexes from creation

        // users table already has email unique constraint

        // Add full-text index for question search
        DB::statement('ALTER TABLE exam_questions ADD FULLTEXT search_question_text(question_text)');
        DB::statement('ALTER TABLE cbt_questions ADD FULLTEXT search_question(question)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop full-text indexes
        DB::statement('ALTER TABLE exam_questions DROP INDEX search_question_text');
        DB::statement('ALTER TABLE cbt_questions DROP INDEX search_question');

        // Drop indexes from cbt_questions
        Schema::table('cbt_questions', function (Blueprint $table) {
            $table->dropIndex(['question_type']);
        });

        // Drop indexes from exam_questions
        Schema::table('exam_questions', function (Blueprint $table) {
            $table->dropIndex(['question_type']);
        });

        // Drop indexes from exam_attempts
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['started_at']);
            $table->dropIndex(['ended_at']);
        });

        // Drop indexes from exams
        Schema::table('exams', function (Blueprint $table) {
            $table->dropIndex(['class_level']);
            $table->dropIndex(['department']);
            $table->dropIndex(['published']);
        });

        // Drop indexes from students
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['student_id']);
            $table->dropIndex(['class_level']);
            $table->dropIndex(['department']);
            $table->dropIndex(['is_active']);
        });
    }
};
