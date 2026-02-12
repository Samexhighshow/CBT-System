<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_attempts', 'ends_at')) {
                $table->timestamp('ends_at')->nullable()->after('started_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'submitted_at')) {
                $table->timestamp('submitted_at')->nullable()->after('ended_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('submitted_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('completed_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'switch_count')) {
                $table->unsignedInteger('switch_count')->default(0)->after('last_activity_at');
            }

            if (!Schema::hasColumn('exam_attempts', 'question_order')) {
                $table->json('question_order')->nullable()->after('switch_count');
            }
        });

        Schema::table('student_answers', function (Blueprint $table) {
            if (!Schema::hasColumn('student_answers', 'flagged')) {
                $table->boolean('flagged')->default(false)->after('answer_text');
            }

            if (!Schema::hasColumn('student_answers', 'saved_at')) {
                $table->timestamp('saved_at')->nullable()->after('flagged');
            }

            if (!Schema::hasColumn('student_answers', 'is_correct')) {
                $table->boolean('is_correct')->nullable()->after('saved_at');
            }

            if (!Schema::hasColumn('student_answers', 'marks_awarded')) {
                $table->decimal('marks_awarded', 8, 2)->nullable()->after('is_correct');
            }

            if (!Schema::hasColumn('student_answers', 'feedback')) {
                $table->text('feedback')->nullable()->after('marks_awarded');
            }

            if (!Schema::hasColumn('student_answers', 'reviewed_by')) {
                $table->unsignedBigInteger('reviewed_by')->nullable()->after('feedback');
                $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            }

            if (!Schema::hasColumn('student_answers', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            }
        });

        if (!Schema::hasTable('exam_attempt_sessions')) {
            Schema::create('exam_attempt_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('attempt_id')->constrained('exam_attempts')->onDelete('cascade');
                $table->string('session_token_hash', 64)->index();
                $table->string('device_id')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->boolean('is_active')->default(true);
                $table->string('revoked_reason')->nullable();
                $table->timestamp('started_at');
                $table->timestamp('last_seen_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->timestamps();

                $table->index(['attempt_id', 'is_active']);
                $table->index('last_seen_at');
            });
        }

        if (!Schema::hasTable('exam_attempt_events')) {
            Schema::create('exam_attempt_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('attempt_id')->constrained('exam_attempts')->onDelete('cascade');
                $table->string('event_type');
                $table->json('meta_json')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['attempt_id', 'event_type']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exam_attempt_events')) {
            Schema::dropIfExists('exam_attempt_events');
        }

        if (Schema::hasTable('exam_attempt_sessions')) {
            Schema::dropIfExists('exam_attempt_sessions');
        }

        Schema::table('student_answers', function (Blueprint $table) {
            if (Schema::hasColumn('student_answers', 'reviewed_by')) {
                $table->dropForeign(['reviewed_by']);
            }

            $dropColumns = array_filter([
                Schema::hasColumn('student_answers', 'reviewed_at') ? 'reviewed_at' : null,
                Schema::hasColumn('student_answers', 'reviewed_by') ? 'reviewed_by' : null,
                Schema::hasColumn('student_answers', 'feedback') ? 'feedback' : null,
                Schema::hasColumn('student_answers', 'marks_awarded') ? 'marks_awarded' : null,
                Schema::hasColumn('student_answers', 'is_correct') ? 'is_correct' : null,
                Schema::hasColumn('student_answers', 'saved_at') ? 'saved_at' : null,
                Schema::hasColumn('student_answers', 'flagged') ? 'flagged' : null,
            ]);

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });

        Schema::table('exam_attempts', function (Blueprint $table) {
            $dropColumns = array_filter([
                Schema::hasColumn('exam_attempts', 'question_order') ? 'question_order' : null,
                Schema::hasColumn('exam_attempts', 'switch_count') ? 'switch_count' : null,
                Schema::hasColumn('exam_attempts', 'last_activity_at') ? 'last_activity_at' : null,
                Schema::hasColumn('exam_attempts', 'completed_at') ? 'completed_at' : null,
                Schema::hasColumn('exam_attempts', 'submitted_at') ? 'submitted_at' : null,
                Schema::hasColumn('exam_attempts', 'ends_at') ? 'ends_at' : null,
            ]);

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
