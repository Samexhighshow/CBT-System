<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('role_scopes', function (Blueprint $table) {
            if (!Schema::hasColumn('role_scopes', 'request_batch_id')) {
                $table->string('request_batch_id', 64)->nullable()->after('role_name')->index();
            }
            if (!Schema::hasColumn('role_scopes', 'request_reason')) {
                $table->text('request_reason')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('role_scopes', function (Blueprint $table) {
            if (Schema::hasColumn('role_scopes', 'request_reason')) {
                $table->dropColumn('request_reason');
            }
            if (Schema::hasColumn('role_scopes', 'request_batch_id')) {
                $table->dropIndex(['request_batch_id']);
                $table->dropColumn('request_batch_id');
            }
        });
    }
};
