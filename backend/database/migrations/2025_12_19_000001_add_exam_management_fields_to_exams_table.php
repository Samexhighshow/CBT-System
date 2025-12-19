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
            // Add subject_id foreign key
            if (!Schema::hasColumn('exams', 'subject_id')) {
                $table->unsignedBigInteger('subject_id')->nullable()->after('description');
                $table->foreign('subject_id')->references('id')->on('subjects')->onDelete('cascade');
            }

            // Add class_id foreign key
            if (!Schema::hasColumn('exams', 'class_id')) {
                $table->unsignedBigInteger('class_id')->nullable()->after('subject_id');
                $table->foreign('class_id')->references('id')->on('school_classes')->onDelete('cascade');
            }

            // Add start_time and end_time for exam scheduling
            if (!Schema::hasColumn('exams', 'start_time')) {
                $table->timestamp('start_time')->nullable()->after('duration_minutes');
            }

            if (!Schema::hasColumn('exams', 'end_time')) {
                $table->timestamp('end_time')->nullable()->after('start_time');
            }

            // Add status enum for exam lifecycle
            if (!Schema::hasColumn('exams', 'status')) {
                $table->enum('status', ['draft', 'scheduled', 'active', 'completed', 'cancelled'])
                    ->default('draft')
                    ->after('end_time');
            }

            // Add indexes for performance
            $table->index('subject_id');
            $table->index('class_id');
            $table->index('status');
            $table->index(['start_time', 'end_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            // Drop foreign keys first
            $table->dropForeign(['subject_id']);
            $table->dropForeign(['class_id']);

            // Drop columns
            $table->dropColumn([
                'subject_id',
                'class_id',
                'start_time',
                'end_time',
                'status'
            ]);
        });
    }
};
