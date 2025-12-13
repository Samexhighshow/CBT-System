<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Delete duplicate subjects keeping only one per class_level + name combination
        DB::statement("
            DELETE s1 FROM subjects s1
            INNER JOIN subjects s2 
            WHERE s1.id > s2.id 
            AND s1.name = s2.name 
            AND s1.class_level = s2.class_level
        ");
    }

    public function down(): void
    {
        // No rollback needed
    }
};
