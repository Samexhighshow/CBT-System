<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('attempt_uuid')->unique();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->integer('score')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('exam_attempts')->onDelete('cascade');
            $table->foreignId('question_id')->constrained('exam_questions')->onDelete('cascade');
            $table->foreignId('option_id')->nullable()->constrained('question_options')->onDelete('set null');
            $table->text('answer_text')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_answers');
        Schema::dropIfExists('exam_attempts');
    }
};
