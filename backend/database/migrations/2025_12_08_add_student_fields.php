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
        Schema::table('students', function (Blueprint $table) {
            // Add missing fields if they don't exist
            if (!Schema::hasColumn('students', 'other_names')) {
                $table->string('other_names')->nullable()->after('last_name');
            }
            if (!Schema::hasColumn('students', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('other_names');
            }
            if (!Schema::hasColumn('students', 'gender')) {
                $table->enum('gender', ['male', 'female'])->nullable()->after('date_of_birth');
            }
            if (!Schema::hasColumn('students', 'phone_number')) {
                $table->string('phone_number')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('students', 'address')) {
                $table->text('address')->nullable()->after('phone_number');
            }
            if (!Schema::hasColumn('students', 'guardian_first_name')) {
                $table->string('guardian_first_name')->nullable()->after('address');
            }
            if (!Schema::hasColumn('students', 'guardian_last_name')) {
                $table->string('guardian_last_name')->nullable()->after('guardian_first_name');
            }
            if (!Schema::hasColumn('students', 'guardian_relationship')) {
                $table->string('guardian_relationship')->nullable()->after('guardian_last_name');
            }
            if (!Schema::hasColumn('students', 'guardian_phone')) {
                $table->string('guardian_phone')->nullable()->after('guardian_relationship');
            }
            if (!Schema::hasColumn('students', 'guardian_gender')) {
                $table->enum('guardian_gender', ['male', 'female'])->nullable()->after('guardian_phone');
            }
            if (!Schema::hasColumn('students', 'class_id')) {
                $table->unsignedBigInteger('class_id')->nullable()->after('guardian_gender');
            }
            if (!Schema::hasColumn('students', 'department_id')) {
                $table->unsignedBigInteger('department_id')->nullable()->after('class_id');
            }
            if (!Schema::hasColumn('students', 'password')) {
                $table->string('password')->nullable()->after('email');
            }
            if (!Schema::hasColumn('students', 'registration_number')) {
                $table->string('registration_number')->unique()->nullable()->after('id');
            }
            if (!Schema::hasColumn('students', 'status')) {
                $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->after('is_active');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Drop columns if they exist
            if (Schema::hasColumn('students', 'other_names')) {
                $table->dropColumn('other_names');
            }
            if (Schema::hasColumn('students', 'date_of_birth')) {
                $table->dropColumn('date_of_birth');
            }
            if (Schema::hasColumn('students', 'gender')) {
                $table->dropColumn('gender');
            }
            if (Schema::hasColumn('students', 'phone_number')) {
                $table->dropColumn('phone_number');
            }
            if (Schema::hasColumn('students', 'address')) {
                $table->dropColumn('address');
            }
            if (Schema::hasColumn('students', 'guardian_first_name')) {
                $table->dropColumn('guardian_first_name');
            }
            if (Schema::hasColumn('students', 'guardian_last_name')) {
                $table->dropColumn('guardian_last_name');
            }
            if (Schema::hasColumn('students', 'guardian_relationship')) {
                $table->dropColumn('guardian_relationship');
            }
            if (Schema::hasColumn('students', 'guardian_phone')) {
                $table->dropColumn('guardian_phone');
            }
            if (Schema::hasColumn('students', 'guardian_gender')) {
                $table->dropColumn('guardian_gender');
            }
            if (Schema::hasColumn('students', 'class_id')) {
                $table->dropColumn('class_id');
            }
            if (Schema::hasColumn('students', 'department_id')) {
                $table->dropColumn('department_id');
            }
            if (Schema::hasColumn('students', 'password')) {
                $table->dropColumn('password');
            }
            if (Schema::hasColumn('students', 'registration_number')) {
                $table->dropColumn('registration_number');
            }
            if (Schema::hasColumn('students', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
