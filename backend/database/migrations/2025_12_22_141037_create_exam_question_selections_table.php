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
        Schema::create('exam_question_selections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->foreignId('student_id')->nullable()->constrained('students')->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            
            // Selected question IDs in order
            $table->json('question_ids');
            
            // Shuffled option IDs per question (for MCQ randomization)
            $table->json('option_shuffles')->nullable();
            
            // Selection metadata
            $table->integer('total_questions');
            $table->integer('total_marks');
            $table->json('distribution_summary')->nullable(); // {easy: 10, medium: 15, hard: 5}
            
            // Lock selection for scoring
            $table->boolean('is_locked')->default(false);
            $table->timestamp('locked_at')->nullable();
            
            $table->timestamps();
            
            // Ensure one selection per student per exam
            $table->unique(['exam_id', 'student_id']);
            
            // Index for fast lookups
            $table->index(['exam_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exam_question_selections');
    }
};
