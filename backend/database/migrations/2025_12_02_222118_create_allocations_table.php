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
        Schema::create('allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('allocation_run_id')->constrained('allocation_runs')->onDelete('cascade');
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->foreignId('hall_id')->constrained('halls')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->unsignedInteger('row');
            $table->unsignedInteger('column');
            $table->unsignedInteger('seat_number'); // Computed from row/col based on numbering strategy
            $table->string('class_level')->nullable(); // For conflict detection
            $table->timestamps();
            
            $table->index(['exam_id', 'hall_id']);
            $table->index('student_id');
            $table->index('allocation_run_id');
            $table->unique(['allocation_run_id', 'hall_id', 'row', 'column']); // One student per seat
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('allocations');
    }
};
