<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_access', function (Blueprint $table) {
            try {
                $table->dropForeign(['student_id']);
            } catch (\Throwable $e) {
                // Ignore when foreign key is already absent or named differently.
            }

            $table->foreign('student_id')->references('id')->on('students')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('exam_access', function (Blueprint $table) {
            try {
                $table->dropForeign(['student_id']);
            } catch (\Throwable $e) {
                // Ignore when foreign key is already absent or named differently.
            }

            $table->foreign('student_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
};
