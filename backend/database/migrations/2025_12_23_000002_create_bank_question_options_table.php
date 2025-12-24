<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bank_question_options')) {
            Schema::create('bank_question_options', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bank_question_id')->constrained('bank_questions')->onDelete('cascade');
                $table->text('option_text');
                $table->boolean('is_correct')->default(false);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
                $table->unique(['bank_question_id','sort_order']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_question_options');
    }
};
