<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * PHASE 5: Admin Actions Database Support
     * Add necessary columns for question ordering and sections
     */
    public function up(): void
    {
        // Add order_index to questions if it doesn't exist
        Schema::table('exam_questions', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_questions', 'order_index')) {
                $table->integer('order_index')->default(0)->after('status');
            }
            
            if (!Schema::hasColumn('exam_questions', 'section_name')) {
                $table->string('section_name')->nullable()->after('order_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exam_questions', function (Blueprint $table) {
            if (Schema::hasColumn('exam_questions', 'order_index')) {
                $table->dropColumn('order_index');
            }
            
            if (Schema::hasColumn('exam_questions', 'section_name')) {
                $table->dropColumn('section_name');
            }
        });
    }
};
