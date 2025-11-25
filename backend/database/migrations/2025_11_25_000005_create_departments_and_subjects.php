<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->string('class_level')->default('SSS');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_compulsory')->default(false);
            $table->string('class_level')->default('JSS');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('trade_subjects', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->foreignId('department_id')->constrained('departments')->onDelete('cascade');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('department_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->onDelete('cascade');
            $table->foreignId('subject_id')->constrained('subjects')->onDelete('cascade');
            $table->boolean('is_compulsory')->default(false);
            $table->timestamps();
            $table->unique(['department_id', 'subject_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('department_subjects');
        Schema::dropIfExists('trade_subjects');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('departments');
    }
};
