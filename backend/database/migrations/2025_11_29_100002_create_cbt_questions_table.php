<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('cbt_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained('cbt_subjects')->onDelete('cascade');
            $table->text('question');
            $table->enum('question_type', [
                'single_choice',    // Pick one answer (A-D or A-E)
                'multiple_choice',  // Pick one or more answers
                'true_false',       // True/False
                'short_answer',     // Student types short answer
                'long_answer'       // Essay/structural question
            ]);
            $table->json('options')->nullable(); // For MCQ: ["Option A", "Option B", "Option C", "Option D"]
            $table->json('correct_answer')->nullable(); // Single: "A", Multiple: ["A", "C"], True/False: "True", Short: "answer"
            $table->integer('points')->default(1); // Marks for this question
            $table->text('explanation')->nullable(); // Optional explanation for correct answer
            $table->timestamps();
            
            $table->index('subject_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('cbt_questions');
    }
};
