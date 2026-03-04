<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_attempts', 'finalized_at')) {
                $table->timestamp('finalized_at')->nullable()->after('completed_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'finalized_by')) {
                $table->unsignedBigInteger('finalized_by')->nullable()->after('finalized_at');
                $table->foreign('finalized_by')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (Schema::hasColumn('exam_attempts', 'finalized_by')) {
                $table->dropForeign(['finalized_by']);
                $table->dropColumn('finalized_by');
            }

            if (Schema::hasColumn('exam_attempts', 'finalized_at')) {
                $table->dropColumn('finalized_at');
            }
        });
    }
};
