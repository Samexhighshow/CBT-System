<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('exam_questions')) {
            Schema::table('exam_questions', function (Blueprint $table) {
                if (!Schema::hasColumn('exam_questions', 'question_text')) {
                    $table->text('question_text')->nullable()->after('exam_id');
                }
                if (!Schema::hasColumn('exam_questions', 'question_type')) {
                    $table->string('question_type')->default('mcq')->after('question_text');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exam_questions')) {
            Schema::table('exam_questions', function (Blueprint $table) {
                if (Schema::hasColumn('exam_questions', 'question_type')) {
                    $table->dropColumn('question_type');
                }
                if (Schema::hasColumn('exam_questions', 'question_text')) {
                    $table->dropColumn('question_text');
                }
            });
        }
    }
};
