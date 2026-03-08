<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_attempts', 'exam_sitting_id')) {
                $table->foreignId('exam_sitting_id')
                    ->nullable()
                    ->after('exam_id')
                    ->constrained('exam_sittings')
                    ->nullOnDelete();

                $table->index(['exam_id', 'exam_sitting_id']);
            }
        });

        $defaultSittings = DB::table('exam_sittings')
            ->select('exam_id', DB::raw('MIN(id) as sitting_id'))
            ->groupBy('exam_id')
            ->pluck('sitting_id', 'exam_id');

        DB::table('exam_attempts')
            ->whereNull('exam_sitting_id')
            ->orderBy('id')
            ->chunkById(500, function ($attempts) use ($defaultSittings) {
                foreach ($attempts as $attempt) {
                    $sittingId = $defaultSittings[$attempt->exam_id] ?? null;
                    if (!$sittingId) {
                        continue;
                    }

                    DB::table('exam_attempts')
                        ->where('id', $attempt->id)
                        ->update(['exam_sitting_id' => (int) $sittingId]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            if (Schema::hasColumn('exam_attempts', 'exam_sitting_id')) {
                $table->dropForeign(['exam_sitting_id']);
                $table->dropIndex(['exam_id', 'exam_sitting_id']);
                $table->dropColumn('exam_sitting_id');
            }
        });
    }
};
