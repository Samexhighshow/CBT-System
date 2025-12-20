<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QuestionPool;
use App\Models\Exam;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class QuestionPoolController extends Controller
{
    /**
     * Get all pools for an exam
     */
    public function index(int $examId): JsonResponse
    {
        $exam = Exam::findOrFail($examId);
        $pools = $exam->questionPools()->with('questions')->get();

        return response()->json([
            'success' => true,
            'data' => $pools,
        ]);
    }

    /**
     * Get active pools for an exam
     */
    public function active(int $examId): JsonResponse
    {
        $pools = QuestionPool::getActiveForExam($examId);

        return response()->json([
            'success' => true,
            'data' => $pools,
        ]);
    }

    /**
     * Create a new pool
     */
    public function store(Request $request, int $examId): JsonResponse
    {
        $exam = Exam::findOrFail($examId);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'draw_count' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pool = $exam->questionPools()->create($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Pool created successfully',
            'data' => $pool,
        ], 201);
    }

    /**
     * Update a pool
     */
    public function update(Request $request, int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'draw_count' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pool->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Pool updated successfully',
            'data' => $pool,
        ]);
    }

    /**
     * Delete a pool
     */
    public function destroy(int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        // Remove pool assignment from questions
        $pool->questions()->update(['pool_name' => null]);

        $pool->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pool deleted successfully',
        ]);
    }

    /**
     * Get pool statistics
     */
    public function stats(int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        $pool->updateStats();

        $questions = $pool->questions;
        $stats = [
            'pool' => $pool,
            'statistics' => [
                'total_questions' => $questions->count(),
                'total_marks' => $questions->sum('marks'),
                'active_questions' => $questions->where('status', 'active')->count(),
                'by_difficulty' => [
                    'easy' => $questions->where('difficulty', 'easy')->count(),
                    'medium' => $questions->where('difficulty', 'medium')->count(),
                    'hard' => $questions->where('difficulty', 'hard')->count(),
                ],
                'by_type' => $questions->groupBy('question_type')
                    ->map(fn($group) => $group->count())
                    ->toArray(),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Draw random questions from pool
     */
    public function draw(Request $request, int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        $validator = Validator::make($request->all(), [
            'count' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $count = $request->get('count');
        $questions = $pool->drawQuestions($count);

        return response()->json([
            'success' => true,
            'data' => [
                'pool' => $pool,
                'drawn_questions' => $questions,
                'count' => $questions->count(),
            ],
        ]);
    }

    /**
     * Assign questions to pool
     */
    public function assignQuestions(Request $request, int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        $validator = Validator::make($request->all(), [
            'question_ids' => 'required|array',
            'question_ids.*' => 'exists:exam_questions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Update questions to belong to this pool
        \App\Models\Question::whereIn('id', $request->question_ids)
            ->where('exam_id', $examId)
            ->update(['pool_name' => $pool->name]);

        $pool->updateStats();

        return response()->json([
            'success' => true,
            'message' => 'Questions assigned to pool successfully',
            'data' => $pool->fresh(),
        ]);
    }

    /**
     * Remove questions from pool
     */
    public function removeQuestions(Request $request, int $examId, int $poolId): JsonResponse
    {
        $pool = QuestionPool::where('exam_id', $examId)
            ->findOrFail($poolId);

        $validator = Validator::make($request->all(), [
            'question_ids' => 'required|array',
            'question_ids.*' => 'exists:exam_questions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Remove pool assignment from questions
        \App\Models\Question::whereIn('id', $request->question_ids)
            ->where('exam_id', $examId)
            ->where('pool_name', $pool->name)
            ->update(['pool_name' => null]);

        $pool->updateStats();

        return response()->json([
            'success' => true,
            'message' => 'Questions removed from pool successfully',
            'data' => $pool->fresh(),
        ]);
    }
}
