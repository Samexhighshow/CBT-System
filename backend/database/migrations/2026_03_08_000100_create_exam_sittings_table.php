<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('exam_sittings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->string('session', 64)->nullable();
            $table->enum('term', ['First Term', 'Second Term', 'Third Term'])->nullable();
            $table->enum('assessment_mode_snapshot', ['ca_test', 'exam'])->default('exam');
            $table->unsignedInteger('question_count')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->enum('status', ['draft', 'scheduled', 'active', 'closed'])->default('draft');
            $table->boolean('results_released')->default(false);
            $table->string('title_override')->nullable();
            $table->text('instructions_override')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['exam_id', 'assessment_mode_snapshot']);
            $table->index(['status', 'start_at', 'end_at']);
            $table->index(['session', 'term']);
        });

        $questionCounts = DB::table('exam_questions')
            ->select('exam_id', DB::raw('COUNT(*) as cnt'))
            ->groupBy('exam_id')
            ->pluck('cnt', 'exam_id');

        DB::table('exams')
            ->orderBy('id')
            ->chunkById(200, function ($exams) use ($questionCounts) {
                $rows = [];
                $now = now();

                foreach ($exams as $exam) {
                    $assessmentType = strtolower(trim((string) ($exam->assessment_type ?? '')));
                    $mode = $assessmentType === 'ca test' ? 'ca_test' : 'exam';

                    $status = match ((string) ($exam->status ?? 'draft')) {
                        'active' => 'active',
                        'scheduled' => 'scheduled',
                        'completed', 'cancelled' => 'closed',
                        default => 'draft',
                    };

                    $rows[] = [
                        'exam_id' => (int) $exam->id,
                        'session' => $exam->academic_session,
                        'term' => $exam->term,
                        'assessment_mode_snapshot' => $mode,
                        'question_count' => isset($questionCounts[$exam->id]) ? (int) $questionCounts[$exam->id] : null,
                        'duration_minutes' => (int) ($exam->duration_minutes ?? 0) > 0 ? (int) $exam->duration_minutes : null,
                        'start_at' => $exam->start_datetime ?? $exam->start_time,
                        'end_at' => $exam->end_datetime ?? $exam->end_time,
                        'status' => $status,
                        'results_released' => (bool) ($exam->results_released ?? false),
                        'title_override' => null,
                        'instructions_override' => null,
                        'created_by' => null,
                        'created_at' => $exam->created_at ?? $now,
                        'updated_at' => $exam->updated_at ?? $now,
                    ];
                }

                if (!empty($rows)) {
                    DB::table('exam_sittings')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_sittings');
    }
};
