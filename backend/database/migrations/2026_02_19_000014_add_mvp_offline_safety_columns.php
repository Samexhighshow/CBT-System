<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('idempotency_key', 191)->unique();
            $table->unsignedBigInteger('exam_id')->nullable()->index();
            $table->unsignedBigInteger('student_id')->nullable()->index();
            $table->string('request_hash', 64);
            $table->unsignedSmallInteger('response_status')->default(200);
            $table->longText('response_json')->nullable();
            $table->timestamps();
        });

        Schema::table('exam_attempts', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_attempts', 'client_started_at')) {
                $table->timestamp('client_started_at')->nullable()->after('started_at');
            }
            if (!Schema::hasColumn('exam_attempts', 'client_submitted_at')) {
                $table->timestamp('client_submitted_at')->nullable()->after('submitted_at');
            }
            if (!Schema::hasColumn('exam_attempts', 'server_started_at')) {
                $table->timestamp('server_started_at')->nullable()->after('client_started_at');
            }
            if (!Schema::hasColumn('exam_attempts', 'server_submitted_at')) {
                $table->timestamp('server_submitted_at')->nullable()->after('client_submitted_at');
            }
            if (!Schema::hasColumn('exam_attempts', 'time_anomaly_flag')) {
                $table->boolean('time_anomaly_flag')->default(false)->after('server_submitted_at');
            }
            if (!Schema::hasColumn('exam_attempts', 'time_anomaly_reason')) {
                $table->string('time_anomaly_reason', 120)->nullable()->after('time_anomaly_flag');
            }
            if (!Schema::hasColumn('exam_attempts', 'sync_status')) {
                $table->enum('sync_status', ['PENDING_SYNC', 'SYNCED', 'FAILED'])->default('PENDING_SYNC')->after('status');
            }
            if (!Schema::hasColumn('exam_attempts', 'sync_version')) {
                $table->unsignedInteger('sync_version')->default(1)->after('sync_status');
            }
            if (!Schema::hasColumn('exam_attempts', 'extra_time_minutes')) {
                $table->unsignedInteger('extra_time_minutes')->default(0)->after('sync_version');
            }
        });

        Schema::create('attempt_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('attempt_id')->nullable()->index();
            $table->unsignedBigInteger('exam_id')->nullable()->index();
            $table->unsignedBigInteger('student_id')->nullable()->index();
            $table->unsignedBigInteger('actor_user_id')->nullable()->index();
            $table->string('action_type', 80)->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempt_actions');

        Schema::table('exam_attempts', function (Blueprint $table) {
            $dropCols = [];
            foreach ([
                'client_started_at',
                'client_submitted_at',
                'server_started_at',
                'server_submitted_at',
                'time_anomaly_flag',
                'time_anomaly_reason',
                'sync_status',
                'sync_version',
                'extra_time_minutes',
            ] as $col) {
                if (Schema::hasColumn('exam_attempts', $col)) {
                    $dropCols[] = $col;
                }
            }

            if (!empty($dropCols)) {
                $table->dropColumn($dropCols);
            }
        });

        Schema::dropIfExists('idempotency_keys');
    }
};

