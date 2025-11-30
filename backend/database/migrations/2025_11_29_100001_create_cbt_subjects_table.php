<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('cbt_subjects', function (Blueprint $table) {
            $table->id();
            $table->string('subject_name');
            $table->string('class_level'); // JSS1, JSS2, JSS3, SS1, SS2, SS3
            $table->foreignId('owner_id')->constrained('users')->onDelete('cascade');
            $table->boolean('shuffle_questions')->default(false);
            $table->integer('questions_required')->default(30); // How many questions students must answer
            $table->integer('total_marks')->default(70); // Total exam marks
            $table->integer('duration_minutes')->default(60); // Exam duration
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            
            $table->index(['owner_id', 'class_level']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('cbt_subjects');
    }
};
