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
        Schema::create('allocation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->string('shuffle_seed', 64); // For reproducible randomization
            $table->enum('mode', ['auto', 'manual'])->default('auto');
            $table->enum('seat_numbering', ['row_major', 'column_major'])->default('row_major');
            $table->enum('adjacency_strictness', ['hard', 'soft'])->default('hard');
            $table->json('metadata')->nullable(); // halls used, conflicts count, etc.
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            $table->index('exam_id');
            $table->index('created_by');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('allocation_runs');
    }
};
