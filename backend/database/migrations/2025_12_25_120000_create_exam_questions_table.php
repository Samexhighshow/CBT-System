<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('exam_questions')) {
            Schema::create('exam_questions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('bank_question_id');
                $table->unsignedInteger('version_number')->nullable();
                $table->unsignedInteger('order_index')->default(0);
                $table->unsignedInteger('marks_override')->nullable();
                $table->timestamps();

                $table->unique(['exam_id', 'bank_question_id', 'version_number'], 'uq_exam_q_version');
                $table->index(['exam_id', 'order_index']);

                $table->foreign('exam_id')->references('id')->on('exams')->onDelete('cascade');
                $table->foreign('bank_question_id')->references('id')->on('bank_questions')->onDelete('restrict');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_questions');
    }
};
