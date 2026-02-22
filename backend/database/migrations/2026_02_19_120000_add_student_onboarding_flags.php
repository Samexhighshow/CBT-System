<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'must_change_password')) {
                $table->boolean('must_change_password')->default(false)->after('password');
            }
            if (!Schema::hasColumn('users', 'onboarding_source')) {
                $table->string('onboarding_source', 50)->nullable()->after('must_change_password');
            }
        });

        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'registration_completed')) {
                $table->boolean('registration_completed')->default(true)->after('status');
            }
            if (!Schema::hasColumn('students', 'created_via_admin')) {
                $table->boolean('created_via_admin')->default(false)->after('registration_completed');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'onboarding_source')) {
                $table->dropColumn('onboarding_source');
            }
            if (Schema::hasColumn('users', 'must_change_password')) {
                $table->dropColumn('must_change_password');
            }
        });

        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'created_via_admin')) {
                $table->dropColumn('created_via_admin');
            }
            if (Schema::hasColumn('students', 'registration_completed')) {
                $table->dropColumn('registration_completed');
            }
        });
    }
};

