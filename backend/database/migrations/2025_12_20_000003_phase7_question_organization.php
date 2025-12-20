<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 7: Question Organization & Advanced Features
     * - Question pools for randomization
     * - Topic/keyword tagging
     * - Enhanced metadata
     */
    public function up(): void
    {
        Schema::table('exam_questions', function (Blueprint $table) {
            // Question pool for grouping (e.g., "Pool A", "Pool B" for randomization)
            if (!Schema::hasColumn('exam_questions', 'pool_name')) {
                $table->string('pool_name', 50)->nullable()->after('difficulty_level');
            }
            
            // Topics/keywords as JSON array for flexible tagging
            if (!Schema::hasColumn('exam_questions', 'topics')) {
                $table->json('topics')->nullable()->after('pool_name');
            }
            
            // Additional metadata
            if (!Schema::hasColumn('exam_questions', 'author_notes')) {
                $table->text('author_notes')->nullable()->after('topics');
            }
            if (!Schema::hasColumn('exam_questions', 'usage_count')) {
                $table->integer('usage_count')->default(0)->after('author_notes');
            }
            if (!Schema::hasColumn('exam_questions', 'last_used_at')) {
                $table->timestamp('last_used_at')->nullable()->after('usage_count');
            }
            
            // Cognitive level (Bloom's taxonomy)
            if (!Schema::hasColumn('exam_questions', 'cognitive_level')) {
                $table->enum('cognitive_level', [
                    'remember',
                    'understand', 
                    'apply',
                    'analyze',
                    'evaluate',
                    'create'
                ])->nullable()->after('difficulty_level');
            }
            
            // Estimated time in seconds
            if (!Schema::hasColumn('exam_questions', 'estimated_time')) {
                $table->integer('estimated_time')->nullable()->after('cognitive_level');
            }
            
            // Question visibility
            if (!Schema::hasColumn('exam_questions', 'is_template')) {
                $table->boolean('is_template')->default(false)->after('status');
            }
            if (!Schema::hasColumn('exam_questions', 'is_archived')) {
                $table->boolean('is_archived')->default(false)->after('is_template');
            }
            
            // Indexes for performance
            if (!Schema::hasIndex('exam_questions', 'exam_questions_pool_name_index')) {
                $table->index('pool_name');
            }
            if (!Schema::hasIndex('exam_questions', 'exam_questions_cognitive_level_index')) {
                $table->index('cognitive_level');
            }
            if (!Schema::hasIndex('exam_questions', 'exam_questions_is_template_index')) {
                $table->index('is_template');
            }
            if (!Schema::hasIndex('exam_questions', 'exam_questions_is_archived_index')) {
                $table->index('is_archived');
            }
            if (!Schema::hasIndex('exam_questions', 'exam_questions_last_used_at_index')) {
                $table->index('last_used_at');
            }
        });

        // Create question_tags table for many-to-many relationship
        Schema::create('question_tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            $table->string('category', 50)->nullable(); // e.g., "subject", "topic", "skill"
            $table->string('color', 7)->default('#3B82F6'); // Hex color for UI
            $table->text('description')->nullable();
            $table->integer('question_count')->default(0);
            $table->timestamps();
            
            $table->index('category');
            $table->index('name');
        });

        // Pivot table for question-tag relationships
        Schema::create('question_tag_pivot', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('exam_questions')->onDelete('cascade');
            $table->foreignId('tag_id')->constrained('question_tags')->onDelete('cascade');
            $table->timestamps();
            
            $table->unique(['question_id', 'tag_id']);
            $table->index('question_id');
            $table->index('tag_id');
        });

        // Question pools table for better organization
        Schema::create('question_pools', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->integer('question_count')->default(0);
            $table->integer('total_marks')->default(0);
            $table->integer('draw_count')->nullable(); // How many to randomly draw
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('exam_id');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('question_tag_pivot');
        Schema::dropIfExists('question_tags');
        Schema::dropIfExists('question_pools');
        
        Schema::table('exam_questions', function (Blueprint $table) {
            $table->dropIndex(['pool_name']);
            $table->dropIndex(['cognitive_level']);
            $table->dropIndex(['is_template']);
            $table->dropIndex(['is_archived']);
            $table->dropIndex(['last_used_at']);
            
            $table->dropColumn([
                'pool_name',
                'topics',
                'author_notes',
                'usage_count',
                'last_used_at',
                'cognitive_level',
                'estimated_time',
                'is_template',
                'is_archived',
            ]);
        });
    }
};
