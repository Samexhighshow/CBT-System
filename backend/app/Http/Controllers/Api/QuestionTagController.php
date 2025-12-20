<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QuestionTag;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class QuestionTagController extends Controller
{
    /**
     * Get all tags
     */
    public function index(Request $request): JsonResponse
    {
        $query = QuestionTag::query();

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $tags = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $tags,
        ]);
    }

    /**
     * Get popular tags
     */
    public function popular(Request $request): JsonResponse
    {
        $limit = $request->get('limit', 10);
        $tags = QuestionTag::getPopular($limit);

        return response()->json([
            'success' => true,
            'data' => $tags,
        ]);
    }

    /**
     * Get tags by category
     */
    public function byCategory(string $category): JsonResponse
    {
        $tags = QuestionTag::getByCategory($category);

        return response()->json([
            'success' => true,
            'data' => $tags,
        ]);
    }

    /**
     * Create a new tag
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:question_tags,name',
            'category' => 'nullable|string|max:50',
            'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'description' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $tag = QuestionTag::create($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Tag created successfully',
            'data' => $tag,
        ], 201);
    }

    /**
     * Update a tag
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tag = QuestionTag::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:50|unique:question_tags,name,' . $id,
            'category' => 'nullable|string|max:50',
            'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'description' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $tag->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Tag updated successfully',
            'data' => $tag,
        ]);
    }

    /**
     * Delete a tag
     */
    public function destroy(int $id): JsonResponse
    {
        $tag = QuestionTag::findOrFail($id);
        $tag->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tag deleted successfully',
        ]);
    }

    /**
     * Attach tags to a question
     */
    public function attachToQuestion(Request $request, int $questionId): JsonResponse
    {
        $question = Question::findOrFail($questionId);

        $validator = Validator::make($request->all(), [
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:question_tags,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $question->tags()->sync($request->tag_ids);

        // Update question counts for all affected tags
        QuestionTag::whereIn('id', $request->tag_ids)->get()->each(function ($tag) {
            $tag->updateQuestionCount();
        });

        return response()->json([
            'success' => true,
            'message' => 'Tags attached successfully',
            'data' => $question->load('tags'),
        ]);
    }

    /**
     * Detach a tag from a question
     */
    public function detachFromQuestion(int $questionId, int $tagId): JsonResponse
    {
        $question = Question::findOrFail($questionId);
        $question->tags()->detach($tagId);

        // Update tag count
        $tag = QuestionTag::find($tagId);
        if ($tag) {
            $tag->updateQuestionCount();
        }

        return response()->json([
            'success' => true,
            'message' => 'Tag removed successfully',
        ]);
    }

    /**
     * Get questions by tag
     */
    public function getQuestions(int $tagId): JsonResponse
    {
        $tag = QuestionTag::findOrFail($tagId);
        $questions = $tag->questions()
            ->with(['exam', 'tags'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'tag' => $tag,
                'questions' => $questions,
            ],
        ]);
    }
}
