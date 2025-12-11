<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title')->index();
            $table->text('content');
            $table->unsignedBigInteger('admin_id');
            $table->boolean('published')->default(true)->index();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            // Foreign key
            $table->foreign('admin_id')->references('id')->on('users')->onDelete('cascade');

            // Indexes for better query performance
            $table->index('published_at');
            $table->index(['published', 'published_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
