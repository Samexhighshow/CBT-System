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
        // Add fields to subjects table
        Schema::table('subjects', function (Blueprint $table) {
            if (!Schema::hasColumn('subjects', 'code')) {
                $table->string('code')->nullable()->after('name');
            }
            if (!Schema::hasColumn('subjects', 'class_id')) {
                $table->foreignId('class_id')->nullable()->after('class_level')->constrained('school_classes')->onDelete('cascade');
            }
            if (!Schema::hasColumn('subjects', 'department_id')) {
                $table->foreignId('department_id')->nullable()->after('class_id')->constrained('departments')->onDelete('set null');
            }
            if (!Schema::hasColumn('subjects', 'subject_type')) {
                $table->enum('subject_type', ['core', 'elective'])->default('core')->after('is_compulsory');
            }
        });

        // Add code field to departments if not exists
        Schema::table('departments', function (Blueprint $table) {
            if (!Schema::hasColumn('departments', 'code')) {
                $table->string('code')->unique()->nullable()->after('name');
            }
        });

        // Update department_subjects pivot table
        if (Schema::hasTable('department_subjects')) {
            Schema::table('department_subjects', function (Blueprint $table) {
                if (!Schema::hasColumn('department_subjects', 'is_core')) {
                    $table->boolean('is_core')->default(true)->after('is_compulsory');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subjects', function (Blueprint $table) {
            if (Schema::hasColumn('subjects', 'class_id')) {
                $table->dropForeign(['class_id']);
                $table->dropColumn('class_id');
            }
            if (Schema::hasColumn('subjects', 'department_id')) {
                $table->dropForeign(['department_id']);
                $table->dropColumn('department_id');
            }
            if (Schema::hasColumn('subjects', 'code')) {
                $table->dropColumn('code');
            }
            if (Schema::hasColumn('subjects', 'subject_type')) {
                $table->dropColumn('subject_type');
            }
        });

        Schema::table('departments', function (Blueprint $table) {
            if (Schema::hasColumn('departments', 'code')) {
                $table->dropColumn('code');
            }
        });

        if (Schema::hasTable('department_subjects')) {
            Schema::table('department_subjects', function (Blueprint $table) {
                if (Schema::hasColumn('department_subjects', 'is_core')) {
                    $table->dropColumn('is_core');
                }
            });
        }
    }
};
