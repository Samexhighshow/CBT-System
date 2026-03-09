<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('exam_sittings')) {
            return;
        }

        Schema::table('exam_sittings', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_sittings', 'question_distribution')) {
                $table->enum('question_distribution', ['same_for_all', 'unique_per_student'])
                    ->nullable()
                    ->after('shuffle_option_order');
            }

            if (!Schema::hasColumn('exam_sittings', 'difficulty_distribution')) {
                $table->json('difficulty_distribution')
                    ->nullable()
                    ->after('question_distribution');
            }

            if (!Schema::hasColumn('exam_sittings', 'marks_distribution')) {
                $table->json('marks_distribution')
                    ->nullable()
                    ->after('difficulty_distribution');
            }

            if (!Schema::hasColumn('exam_sittings', 'topic_filters')) {
                $table->json('topic_filters')
                    ->nullable()
                    ->after('marks_distribution');
            }

            if (!Schema::hasColumn('exam_sittings', 'question_reuse_policy')) {
                $table->enum('question_reuse_policy', ['allow_reuse', 'no_reuse_until_exhausted'])
                    ->nullable()
                    ->after('topic_filters');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('exam_sittings')) {
            return;
        }

        Schema::table('exam_sittings', function (Blueprint $table) {
            if (Schema::hasColumn('exam_sittings', 'question_reuse_policy')) {
                $table->dropColumn('question_reuse_policy');
            }

            if (Schema::hasColumn('exam_sittings', 'topic_filters')) {
                $table->dropColumn('topic_filters');
            }

            if (Schema::hasColumn('exam_sittings', 'marks_distribution')) {
                $table->dropColumn('marks_distribution');
            }

            if (Schema::hasColumn('exam_sittings', 'difficulty_distribution')) {
                $table->dropColumn('difficulty_distribution');
            }

            if (Schema::hasColumn('exam_sittings', 'question_distribution')) {
                $table->dropColumn('question_distribution');
            }
        });
    }
};
