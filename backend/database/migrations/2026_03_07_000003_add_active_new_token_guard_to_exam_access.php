<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('exam_access')) {
            return;
        }

        Schema::table('exam_access', function (Blueprint $table) {
            if (!Schema::hasColumn('exam_access', 'active_new_token')) {
                $table->tinyInteger('active_new_token')->nullable()->after('status');
            }
        });

        // Populate guard token for currently active NEW rows.
        DB::statement("\n            UPDATE exam_access\n            SET active_new_token = CASE\n                WHEN student_id IS NOT NULL\n                    AND (used = 0 OR used IS NULL)\n                    AND UPPER(COALESCE(status, 'NEW')) = 'NEW'\n                THEN 1\n                ELSE NULL\n            END\n        ");

        // Keep only the latest active NEW row per exam/student pair.
        DB::statement("\n            UPDATE exam_access older\n            INNER JOIN exam_access newer\n                ON older.exam_id = newer.exam_id\n                AND older.student_id = newer.student_id\n                AND older.active_new_token = 1\n                AND newer.active_new_token = 1\n                AND older.id < newer.id\n            SET\n                older.active_new_token = NULL,\n                older.status = 'VOID',\n                older.used = 1,\n                older.used_at = NOW(),\n                older.expires_at = NOW(),\n                older.updated_at = NOW()\n        ");

        Schema::table('exam_access', function (Blueprint $table) {
            $indexName = 'exam_access_active_new_unique_idx';
            if (!$this->hasIndex('exam_access', $indexName)) {
                $table->unique(['exam_id', 'student_id', 'active_new_token'], $indexName);
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('exam_access')) {
            return;
        }

        Schema::table('exam_access', function (Blueprint $table) {
            $indexName = 'exam_access_active_new_unique_idx';
            if ($this->hasIndex('exam_access', $indexName)) {
                $table->dropUnique($indexName);
            }

            if (Schema::hasColumn('exam_access', 'active_new_token')) {
                $table->dropColumn('active_new_token');
            }
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();

        $result = DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();

        return (bool) $result;
    }
};
