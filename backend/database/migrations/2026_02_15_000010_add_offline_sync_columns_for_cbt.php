<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'offline_login_enabled')) {
                $table->boolean('offline_login_enabled')->default(false)->after('password');
            }
            if (!Schema::hasColumn('users', 'offline_pin_hash')) {
                $table->string('offline_pin_hash', 255)->nullable()->after('offline_login_enabled');
            }
        });

        Schema::table('exam_access', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_access', 'client_code_id')) {
                $table->uuid('client_code_id')->nullable()->after('id');
                $table->unique('client_code_id');
            }

            if (!Schema::hasColumn('exam_access', 'status')) {
                $table->enum('status', ['NEW', 'USED', 'VOID'])->default('NEW')->after('access_code');
                $table->index(['exam_id', 'student_id', 'status'], 'exam_access_exam_student_status_idx');
            }

            if (!Schema::hasColumn('exam_access', 'used_by_device_id')) {
                $table->string('used_by_device_id', 128)->nullable()->after('used_at');
            }

            if (!Schema::hasColumn('exam_access', 'attempt_uuid')) {
                $table->string('attempt_uuid', 64)->nullable()->after('used_by_device_id');
                $table->index('attempt_uuid');
            }
        });

        // Keep legacy used flag in sync for existing rows.
        \DB::statement("UPDATE exam_access SET status = CASE WHEN used = 1 THEN 'USED' ELSE 'NEW' END WHERE status IS NULL OR status = ''");
    }

    public function down(): void
    {
        Schema::table('exam_access', function (Blueprint $table) {
            if (Schema::hasColumn('exam_access', 'attempt_uuid')) {
                $table->dropIndex(['attempt_uuid']);
                $table->dropColumn('attempt_uuid');
            }
            if (Schema::hasColumn('exam_access', 'used_by_device_id')) {
                $table->dropColumn('used_by_device_id');
            }
            if (Schema::hasColumn('exam_access', 'status')) {
                $table->dropIndex('exam_access_exam_student_status_idx');
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('exam_access', 'client_code_id')) {
                $table->dropUnique(['client_code_id']);
                $table->dropColumn('client_code_id');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'offline_pin_hash')) {
                $table->dropColumn('offline_pin_hash');
            }
            if (Schema::hasColumn('users', 'offline_login_enabled')) {
                $table->dropColumn('offline_login_enabled');
            }
        });
    }
};

