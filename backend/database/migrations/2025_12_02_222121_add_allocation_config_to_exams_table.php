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
        Schema::table('exams', function (Blueprint $table) {
            $table->boolean('shuffle_questions')->default(true);
            $table->enum('seat_numbering', ['row_major', 'column_major'])->default('row_major');
            $table->boolean('enforce_adjacency_rules')->default(true);
            $table->json('allocation_config')->nullable(); // Additional rules, class grouping preferences
        });
    }

    /**
     * Reverse the migrations.     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn(['shuffle_questions', 'seat_numbering', 'enforce_adjacency_rules', 'allocation_config']);
        });
    }
};
