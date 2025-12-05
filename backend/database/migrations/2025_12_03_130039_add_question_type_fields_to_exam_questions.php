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
        Schema::table('exam_questions', function (Blueprint $table) {
            // Add marks and difficulty level if not exists
            if (!Schema::hasColumn('exam_questions', 'marks')) {
                $table->integer('marks')->default(1)->after('question_type');
            }
            if (!Schema::hasColumn('exam_questions', 'difficulty_level')) {
                $table->enum('difficulty_level', ['easy', 'medium', 'hard'])->default('medium')->after('marks');
            }
            
            // Add max_words for essay questions
            if (!Schema::hasColumn('exam_questions', 'max_words')) {
                $table->integer('max_words')->nullable()->after('difficulty_level')
                    ->comment('Maximum word count for essay questions');
            }
            
            // Add marking_rubric for structured essays
            if (!Schema::hasColumn('exam_questions', 'marking_rubric')) {
                $table->text('marking_rubric')->nullable()->after('max_words')
                    ->comment('Marking criteria for essay questions');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exam_questions', function (Blueprint $table) {
            $table->dropColumn(['marks', 'difficulty_level', 'max_words', 'marking_rubric']);
        });
    }
};
