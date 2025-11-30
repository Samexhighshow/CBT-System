<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('cbt_student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_exam_id')->constrained('cbt_student_exams')->onDelete('cascade');
            $table->foreignId('question_id')->constrained('cbt_questions')->onDelete('cascade');
            $table->json('answer')->nullable(); // Student's answer (string or array for multiple choice)
            $table->decimal('marks_awarded', 8, 2)->nullable(); // Marks given for this answer
            $table->boolean('is_correct')->nullable(); // Auto-marked questions
            $table->boolean('manually_graded')->default(false); // For long_answer questions
            $table->text('teacher_feedback')->nullable(); // Optional feedback from teacher
            $table->foreignId('graded_by')->nullable()->constrained('users')->onDelete('set null'); // Teacher who graded
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();
            
            $table->index('student_exam_id');
            $table->index('question_id');
            $table->unique(['student_exam_id', 'question_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('cbt_student_answers');
    }
};
