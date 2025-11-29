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
        Schema::table('users', function (Blueprint $table) {
            $table->string('profile_picture')->nullable()->after('email');
            $table->boolean('two_factor_enabled')->default(false)->after('password');
            $table->string('two_factor_type')->nullable()->after('two_factor_enabled');
            $table->string('google2fa_secret')->nullable()->after('two_factor_type');
            $table->string('google2fa_secret_temp')->nullable()->after('google2fa_secret');
            $table->string('two_factor_code')->nullable()->after('google2fa_secret_temp');
            $table->timestamp('two_factor_expires_at')->nullable()->after('two_factor_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'profile_picture',
                'two_factor_enabled',
                'two_factor_type',
                'google2fa_secret',
                'google2fa_secret_temp',
                'two_factor_code',
                'two_factor_expires_at'
            ]);
        });
    }
};
