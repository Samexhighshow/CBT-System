<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_scopes', function (Blueprint $table) {
            if (!Schema::hasColumn('role_scopes', 'status')) {
                $table->string('status', 20)->default('approved')->after('is_active');
            }
            if (!Schema::hasColumn('role_scopes', 'requested_by')) {
                $table->foreignId('requested_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('role_scopes', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('requested_by')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('role_scopes', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
            if (!Schema::hasColumn('role_scopes', 'rejected_reason')) {
                $table->text('rejected_reason')->nullable()->after('approved_at');
            }
        });

        Schema::table('role_scopes', function (Blueprint $table) {
            $table->dropUnique('role_scopes_unique_combo');
            $table->unique(
                ['user_id', 'role_name', 'subject_id', 'class_id', 'academic_session', 'term'],
                'role_scopes_unique_scope'
            );
        });
    }

    public function down(): void
    {
        Schema::table('role_scopes', function (Blueprint $table) {
            $table->dropUnique('role_scopes_unique_scope');
            $table->unique(
                ['user_id', 'role_name', 'subject_id', 'class_id', 'exam_id', 'academic_session', 'term'],
                'role_scopes_unique_combo'
            );

            if (Schema::hasColumn('role_scopes', 'rejected_reason')) {
                $table->dropColumn('rejected_reason');
            }
            if (Schema::hasColumn('role_scopes', 'approved_at')) {
                $table->dropColumn('approved_at');
            }
            if (Schema::hasColumn('role_scopes', 'approved_by')) {
                $table->dropConstrainedForeignId('approved_by');
            }
            if (Schema::hasColumn('role_scopes', 'requested_by')) {
                $table->dropConstrainedForeignId('requested_by');
            }
            if (Schema::hasColumn('role_scopes', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};

