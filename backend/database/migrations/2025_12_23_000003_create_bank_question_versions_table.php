<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bank_question_versions')) {
            Schema::create('bank_question_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bank_question_id')->constrained('bank_questions')->onDelete('cascade');
                $table->unsignedInteger('version_number')->default(1);
                $table->string('question_text');
                $table->enum('question_type', [
                    'multiple_choice',
                    'multiple_select',
                    'true_false',
                    'short_answer',
                    'long_answer',
                    'file_upload'
                ]);
                $table->unsignedInteger('marks');
                $table->enum('difficulty', ['Easy','Medium','Hard']);
                $table->text('instructions')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
                $table->string('change_notes')->nullable();
                $table->timestamps();
                $table->unique(['bank_question_id','version_number']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_question_versions');
    }
};
