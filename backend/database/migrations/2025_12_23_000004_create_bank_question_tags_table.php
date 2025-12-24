<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bank_question_tags')) {
            Schema::create('bank_question_tags', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->text('description')->nullable();
                $table->timestamps();
                $table->index('name');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_question_tags');
    }
};
