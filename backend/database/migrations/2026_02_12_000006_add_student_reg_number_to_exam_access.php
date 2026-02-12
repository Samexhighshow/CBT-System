<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_access', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_access', 'student_reg_number')) {
                $table->string('student_reg_number', 64)->nullable()->after('student_id');
                $table->index('student_reg_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('exam_access', function (Blueprint $table) {
            if (Schema::hasColumn('exam_access', 'student_reg_number')) {
                $table->dropIndex(['student_reg_number']);
                $table->dropColumn('student_reg_number');
            }
        });
    }
};
