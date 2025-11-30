<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('teacher_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('cbt_subject_id')->constrained('cbt_subjects')->onDelete('cascade');
            $table->enum('class_category', ['junior', 'senior']); // JSS or SSS
            $table->timestamps();
            
            $table->unique(['teacher_id', 'cbt_subject_id', 'class_category']);
            $table->index('teacher_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('teacher_subjects');
    }
};
