<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bank_question_tag')) {
            Schema::create('bank_question_tag', function (Blueprint $table) {
                $table->foreignId('bank_question_id')->constrained('bank_questions')->onDelete('cascade');
                $table->foreignId('bank_question_tag_id')->constrained('bank_question_tags')->onDelete('cascade');
                $table->primary(['bank_question_id','bank_question_tag_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_question_tag');
    }
};
