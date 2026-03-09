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
            if (!Schema::hasColumn('exam_sittings', 'question_selection_mode')) {
                $table->enum('question_selection_mode', ['fixed', 'random'])
                    ->nullable()
                    ->after('question_count');
            }

            if (!Schema::hasColumn('exam_sittings', 'shuffle_question_order')) {
                $table->boolean('shuffle_question_order')
                    ->nullable()
                    ->after('question_selection_mode');
            }

            if (!Schema::hasColumn('exam_sittings', 'shuffle_option_order')) {
                $table->boolean('shuffle_option_order')
                    ->nullable()
                    ->after('shuffle_question_order');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('exam_sittings')) {
            return;
        }

        Schema::table('exam_sittings', function (Blueprint $table) {
            if (Schema::hasColumn('exam_sittings', 'shuffle_option_order')) {
                $table->dropColumn('shuffle_option_order');
            }

            if (Schema::hasColumn('exam_sittings', 'shuffle_question_order')) {
                $table->dropColumn('shuffle_question_order');
            }

            if (Schema::hasColumn('exam_sittings', 'question_selection_mode')) {
                $table->dropColumn('question_selection_mode');
            }
        });
    }
};
