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
        Schema::create('seat_conflicts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('allocation_id')->constrained('allocations')->onDelete('cascade');
            $table->foreignId('conflicting_allocation_id')->constrained('allocations')->onDelete('cascade');
            $table->enum('type', ['same_class_adjacent', 'same_class_front_back', 'same_class_diagonal']);
            $table->text('details')->nullable(); // JSON with positions, class info
            $table->boolean('resolved')->default(false);
            $table->timestamps();
            
            $table->index('allocation_id');
            $table->index(['resolved', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seat_conflicts');
    }
};
