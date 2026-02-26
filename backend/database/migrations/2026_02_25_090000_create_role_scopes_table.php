<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_scopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role_name')->nullable();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignId('class_id')->nullable()->constrained('school_classes')->nullOnDelete();
            $table->foreignId('exam_id')->nullable()->constrained('exams')->nullOnDelete();
            $table->string('academic_session')->nullable();
            $table->string('term')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->index(['role_name', 'is_active']);
            $table->index(['subject_id', 'class_id']);
            $table->unique(
                ['user_id', 'role_name', 'subject_id', 'class_id', 'exam_id', 'academic_session', 'term'],
                'role_scopes_unique_combo'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_scopes');
    }
};

