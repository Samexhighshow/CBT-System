<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * PHASE 3: DATABASE & MODEL SETUP
     * Add comprehensive fields for 14 question types and update schema
     */
    public function up(): void
    {
        // Step 1: Update exam_questions table with all required fields
        Schema::table('exam_questions', function (Blueprint $table) {
            // Add question_media for images, audio, video
            if (!Schema::hasColumn('exam_questions', 'question_media')) {
                $table->json('question_media')->nullable()->after('question_text')
                    ->comment('JSON field for image_url, audio_url, video_url');
            }

            // Add is_required flag
            if (!Schema::hasColumn('exam_questions', 'is_required')) {
                $table->boolean('is_required')->default(true)->after('marks')
                    ->comment('Whether this question is mandatory');
            }

            // Add time_limit for specific questions
            if (!Schema::hasColumn('exam_questions', 'time_limit')) {
                $table->integer('time_limit')->nullable()->after('is_required')
                    ->comment('Time limit in seconds for this specific question');
            }

            // Add shuffle_options for MCQ type questions
            if (!Schema::hasColumn('exam_questions', 'shuffle_options')) {
                $table->boolean('shuffle_options')->default(false)->after('time_limit')
                    ->comment('Whether to shuffle options for MCQ questions');
            }

            // Add status field
            if (!Schema::hasColumn('exam_questions', 'status')) {
                $table->enum('status', ['draft', 'active', 'disabled'])->default('draft')->after('shuffle_options')
                    ->comment('Question visibility/usage status');
            }

            // Add JSON fields for complex question types
            if (!Schema::hasColumn('exam_questions', 'question_data')) {
                $table->json('question_data')->nullable()->after('question_media')
                    ->comment('JSON for storing type-specific data (blanks, pairs, items, passage, case study, formula, scenario)');
            }
        });

        // Step 2: Update question_options table with missing fields
        Schema::table('question_options', function (Blueprint $table) {
            // Add option_media for image-based options
            if (!Schema::hasColumn('question_options', 'option_media')) {
                $table->json('option_media')->nullable()->after('option_text')
                    ->comment('JSON field for image_url, audio_url of option');
            }

            // Add order_index to maintain option sequence
            if (!Schema::hasColumn('question_options', 'order_index')) {
                $table->integer('order_index')->default(0)->after('is_correct')
                    ->comment('Display order of options');
            }
        });

        // Step 3: Create missing indexes (avoid duplicates)
        Schema::table('exam_questions', function (Blueprint $table) {
            // exam_id index - will be added if not exists
            if (!$this->indexExists('exam_questions', 'exam_questions_exam_id_index')) {
                $table->index('exam_id');
            }
            // status index - new
            if (!$this->indexExists('exam_questions', 'exam_questions_status_index')) {
                $table->index('status');
            }
            // difficulty_level index - new
            if (!$this->indexExists('exam_questions', 'exam_questions_difficulty_level_index')) {
                $table->index('difficulty_level');
            }
        });

        Schema::table('question_options', function (Blueprint $table) {
            // question_id index - will be added if not exists
            if (!$this->indexExists('question_options', 'question_options_question_id_index')) {
                $table->index('question_id');
            }
            // is_correct index - new
            if (!$this->indexExists('question_options', 'question_options_is_correct_index')) {
                $table->index('is_correct');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('question_options', function (Blueprint $table) {
            if ($this->indexExists('question_options', 'question_options_question_id_index')) {
                $table->dropIndex(['question_id']);
            }
            if ($this->indexExists('question_options', 'question_options_is_correct_index')) {
                $table->dropIndex(['is_correct']);
            }
            $table->dropColumn(['option_media', 'order_index']);
        });

        Schema::table('exam_questions', function (Blueprint $table) {
            if ($this->indexExists('exam_questions', 'exam_questions_status_index')) {
                $table->dropIndex(['status']);
            }
            if ($this->indexExists('exam_questions', 'exam_questions_difficulty_level_index')) {
                $table->dropIndex(['difficulty_level']);
            }
            $table->dropColumn(['question_media', 'is_required', 'time_limit', 'shuffle_options', 'status', 'question_data']);
        });
    }

    /**
     * Helper to check if index exists
     */
    private function indexExists($table, $indexName): bool
    {
        $indexes = collect(\DB::select("SHOW INDEXES FROM {$table}"))
            ->pluck('Key_name')
            ->all();
        return in_array($indexName, $indexes);
    }
};
