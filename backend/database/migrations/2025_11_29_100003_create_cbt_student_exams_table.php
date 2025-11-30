<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('cbt_student_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('subject_id')->constrained('cbt_subjects')->onDelete('cascade');
            $table->json('selected_questions'); // Array of question IDs assigned to this student
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->enum('status', ['not_started', 'in_progress', 'submitted', 'graded'])->default('not_started');
            $table->decimal('score', 8, 2)->nullable(); // Total score achieved
            $table->decimal('total_marks', 8, 2)->nullable(); // Total possible marks
            $table->integer('duration_seconds')->nullable(); // Actual time spent
            $table->boolean('requires_manual_grading')->default(false); // Has long_answer questions
            $table->timestamps();
            
            $table->index(['student_id', 'subject_id']);
            $table->index('status');
        });
    }

    public function down()
    {
        Schema::dropIfExists('cbt_student_exams');
    }
};
