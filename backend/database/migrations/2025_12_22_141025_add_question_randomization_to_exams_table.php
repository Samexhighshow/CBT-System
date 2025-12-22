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
        Schema::table('exams', function (Blueprint $table) {
            // Question Selection Mode
            $table->enum('question_selection_mode', ['fixed', 'random'])->default('fixed')->after('randomize_options');
            
            // Total questions to serve (null = all questions)
            $table->integer('total_questions_to_serve')->nullable()->after('question_selection_mode');
            
            // Shuffle options
            $table->boolean('shuffle_question_order')->default(false)->after('total_questions_to_serve');
            $table->boolean('shuffle_option_order')->default(false)->after('shuffle_question_order');
            
            // Question distribution per student
            $table->enum('question_distribution', ['same_for_all', 'unique_per_student'])->default('same_for_all')->after('shuffle_option_order');
            
            // Difficulty distribution (JSON: {easy: 10, medium: 15, hard: 5})
            $table->json('difficulty_distribution')->nullable()->after('question_distribution');
            
            // Marks distribution (JSON: {2: 10, 5: 5, 10: 3})
            $table->json('marks_distribution')->nullable()->after('difficulty_distribution');
            
            // Topic filters (JSON array of topic names to include)
            $table->json('topic_filters')->nullable()->after('marks_distribution');
            
            // Reuse policy
            $table->enum('question_reuse_policy', ['allow_reuse', 'no_reuse_until_exhausted'])->default('allow_reuse')->after('topic_filters');
            
            // Track if question selection has been generated
            $table->boolean('questions_locked')->default(false)->after('question_reuse_policy');
            $table->timestamp('questions_locked_at')->nullable()->after('questions_locked');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn([
                'question_selection_mode',
                'total_questions_to_serve',
                'shuffle_question_order',
                'shuffle_option_order',
                'question_distribution',
                'difficulty_distribution',
                'marks_distribution',
                'topic_filters',
                'question_reuse_policy',
                'questions_locked',
                'questions_locked_at'
            ]);
        });
    }
};
