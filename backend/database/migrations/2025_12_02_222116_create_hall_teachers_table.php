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
        Schema::create('hall_teachers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hall_id')->constrained('halls')->onDelete('cascade');
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('exam_id')->nullable()->constrained('exams')->onDelete('cascade');
            $table->string('role')->default('supervisor'); // supervisor, chief_supervisor
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();
            
            $table->index(['hall_id', 'exam_id']);
            $table->index('teacher_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hall_teachers');
    }
};
