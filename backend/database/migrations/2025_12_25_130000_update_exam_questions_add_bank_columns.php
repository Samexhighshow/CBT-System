<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('exam_questions')) {
            Schema::table('exam_questions', function (Blueprint $table) {
                if (!Schema::hasColumn('exam_questions', 'bank_question_id')) {
                    $table->unsignedBigInteger('bank_question_id')->after('exam_id');
                }
                if (!Schema::hasColumn('exam_questions', 'version_number')) {
                    $table->unsignedInteger('version_number')->nullable()->after('bank_question_id');
                }
                if (!Schema::hasColumn('exam_questions', 'order_index')) {
                    $table->unsignedInteger('order_index')->default(0)->after('version_number');
                }
                if (!Schema::hasColumn('exam_questions', 'marks_override')) {
                    $table->unsignedInteger('marks_override')->nullable()->after('order_index');
                }
            });

            // Add foreign keys and indexes where possible
            try {
                Schema::table('exam_questions', function (Blueprint $table) {
                    // Add FK only if column exists and FK likely doesn't
                    if (Schema::hasColumn('exam_questions', 'bank_question_id')) {
                        // MySQL may error if FK exists; wrap in try/catch
                        try {
                            $table->foreign('bank_question_id', 'fk_exam_questions_bank')
                                ->references('id')->on('bank_questions')
                                ->onDelete('restrict');
                        } catch (\Throwable $e) {
                            // ignore
                        }
                    }
                    try {
                        $table->index(['exam_id', 'order_index'], 'idx_exam_order');
                    } catch (\Throwable $e) {
                        // ignore
                    }
                    // Unique composite where supported
                    try {
                        $table->unique(['exam_id', 'bank_question_id', 'version_number'], 'uq_exam_q_version');
                    } catch (\Throwable $e) {
                        // ignore
                    }
                });
            } catch (\Throwable $e) {
                // ignore any index/FK errors
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exam_questions')) {
            Schema::table('exam_questions', function (Blueprint $table) {
                // Drop constraints safely
                try { $table->dropUnique('uq_exam_q_version'); } catch (\Throwable $e) {}
                try { $table->dropIndex('idx_exam_order'); } catch (\Throwable $e) {}
                try { $table->dropForeign('fk_exam_questions_bank'); } catch (\Throwable $e) {}

                if (Schema::hasColumn('exam_questions', 'marks_override')) {
                    $table->dropColumn('marks_override');
                }
                if (Schema::hasColumn('exam_questions', 'order_index')) {
                    $table->dropColumn('order_index');
                }
                if (Schema::hasColumn('exam_questions', 'version_number')) {
                    $table->dropColumn('version_number');
                }
                if (Schema::hasColumn('exam_questions', 'bank_question_id')) {
                    $table->dropColumn('bank_question_id');
                }
            });
        }
    }
};
