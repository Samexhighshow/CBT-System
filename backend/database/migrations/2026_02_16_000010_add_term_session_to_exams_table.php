<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            if (!Schema::hasColumn('exams', 'academic_session')) {
                $table->string('academic_session')->nullable()->after('assessment_weight');
            }

            if (!Schema::hasColumn('exams', 'term')) {
                $table->enum('term', ['First Term', 'Second Term', 'Third Term'])
                    ->nullable()
                    ->after('academic_session');
                $table->index('term');
            }
        });
    }

    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            if (Schema::hasColumn('exams', 'term')) {
                try {
                    $table->dropIndex(['term']);
                } catch (\Throwable $e) {
                    // Ignore if index does not exist on this environment.
                }
                $table->dropColumn('term');
            }

            if (Schema::hasColumn('exams', 'academic_session')) {
                $table->dropColumn('academic_session');
            }
        });
    }
};
