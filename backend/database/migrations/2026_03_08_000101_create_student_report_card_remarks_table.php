<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('student_report_card_remarks')) {
            return;
        }

        Schema::create('student_report_card_remarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->foreignId('class_id')->constrained('school_classes')->onDelete('cascade');
            $table->string('academic_session', 32);
            $table->string('term', 32);
            $table->text('teacher_remark')->nullable();
            $table->text('principal_remark')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['student_id', 'class_id', 'academic_session', 'term'], 'student_report_card_remarks_unique');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('student_report_card_remarks')) {
            return;
        }

        Schema::dropIfExists('student_report_card_remarks');
    }
};
