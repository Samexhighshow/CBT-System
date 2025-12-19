<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            // Academic Management style: link to classes
            if (!Schema::hasColumn('exams', 'class_level_id')) {
                $table->unsignedBigInteger('class_level_id')->nullable()->after('class_id');
                $table->foreign('class_level_id')->references('id')->on('school_classes')->onDelete('cascade');
                $table->index('class_level_id');
            }

            // Exam rules
            if (!Schema::hasColumn('exams', 'allowed_attempts')) {
                $table->unsignedInteger('allowed_attempts')->default(1)->after('duration_minutes');
            }
            if (!Schema::hasColumn('exams', 'randomize_questions')) {
                $table->boolean('randomize_questions')->default(true)->after('allowed_attempts');
            }
            if (!Schema::hasColumn('exams', 'randomize_options')) {
                $table->boolean('randomize_options')->default(true)->after('randomize_questions');
            }
            if (!Schema::hasColumn('exams', 'navigation_mode')) {
                $table->enum('navigation_mode', ['free', 'linear'])->default('free')->after('randomize_options');
            }

            // Scheduling
            if (!Schema::hasColumn('exams', 'start_datetime')) {
                $table->timestamp('start_datetime')->nullable()->after('end_time');
            }
            if (!Schema::hasColumn('exams', 'end_datetime')) {
                $table->timestamp('end_datetime')->nullable()->after('start_datetime');
            }

            // Lifecycle
            if (!Schema::hasColumn('exams', 'results_released')) {
                $table->boolean('results_released')->default(false)->after('status');
            }

            // Useful indexes (skip if already present)
        });

        // Backfill new scheduling columns from legacy fields
        DB::table('exams')->update([
            'start_datetime' => DB::raw('start_time'),
            'end_datetime' => DB::raw('end_time'),
        ]);

        // Backfill class_level_id from class_id if available
        DB::table('exams')->whereNull('class_level_id')->whereNotNull('class_id')->update([
            'class_level_id' => DB::raw('class_id'),
        ]);
    }

    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            if (Schema::hasColumn('exams', 'class_level_id')) {
                $table->dropForeign(['class_level_id']);
                $table->dropIndex(['class_level_id']);
                $table->dropColumn('class_level_id');
            }

            if (Schema::hasColumn('exams', 'results_released')) {
                $table->dropColumn('results_released');
            }

            if (Schema::hasColumn('exams', 'start_datetime') || Schema::hasColumn('exams', 'end_datetime')) {
                $table->dropColumn(['start_datetime', 'end_datetime']);
            }

            foreach (['allowed_attempts', 'randomize_questions', 'randomize_options', 'navigation_mode'] as $col) {
                if (Schema::hasColumn('exams', $col)) {
                    $table->dropColumn($col);
                }
            }

        });
    }
};
