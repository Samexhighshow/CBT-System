<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bank_questions')) {
            Schema::create('bank_questions', function (Blueprint $table) {
                $table->id();
                $table->string('question_text');
                $table->enum('question_type', [
                    'multiple_choice',
                    'multiple_select',
                    'true_false',
                    'short_answer',
                    'long_answer',
                    'file_upload'
                ])->default('multiple_choice');
                $table->unsignedInteger('marks')->default(1);
                $table->enum('difficulty', ['Easy','Medium','Hard'])->default('Medium');
                $table->foreignId('subject_id')->nullable()->constrained('subjects')->onDelete('cascade');
                $table->string('class_level')->nullable();
                $table->text('instructions')->nullable();
                $table->enum('status', ['Draft','Active','Inactive','Archived'])->default('Draft');
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();
                $table->softDeletes();

                $table->index(['question_type','status','difficulty']);
                $table->index('subject_id');
                $table->index('class_level');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_questions');
    }
};
