<?php

namespace App\Http\Controllers\Api;

use App\Models\QuestionBank;
use App\Models\QuestionBankOption;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class QuestionBankController extends Controller
{
    /**
     * Get all questions with filters
     */
    public function index(Request $request)
    {
        $query = QuestionBank::query()->with(['subject', 'creator', 'options', 'tags']);

        // Filters
        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }
        if ($request->filled('class_level')) {
            $query->where('class_level', $request->class_level);
        }
        if ($request->filled('question_type')) {
            $query->where('question_type', $request->question_type);
        }
        if ($request->filled('difficulty')) {
            $query->where('difficulty', $request->difficulty);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $query->where('question_text', 'like', "%{$request->search}%");
        }

        // Only active questions for exams
        if ($request->boolean('active_only')) {
            $query->where('status', 'Active');
        }

        $limit = min($request->integer('limit', 20), 100);
        $paginated = $query->paginate($limit);

        return response()->json([
            'data' => $paginated->items(),
            'total' => $paginated->total(),
            'page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage(),
        ]);
    }

    /**
     * Get single question with full details
     */
    public function show($id)
    {
        $question = QuestionBank::with(['subject', 'creator', 'options', 'versions', 'tags'])->findOrFail($id);
        return response()->json($question);
    }

    /**
     * Create question
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'question_text' => 'required|string|min:5',
            'question_type' => 'required|in:multiple_choice,multiple_select,true_false,short_answer,long_answer,file_upload',
            'marks' => 'required|integer|min:1|max:1000',
            'difficulty' => 'required|in:Easy,Medium,Hard',
            'subject_id' => 'required|integer|exists:subjects,id',
            'class_level' => 'required|string',
            'status' => 'required|in:Draft,Active,Inactive,Archived',
            'instructions' => 'nullable|string',
            'options' => 'required_if:question_type,multiple_choice,multiple_select,true_false|array',
            'options.*.text' => 'required_with:options|string',
            'options.*.is_correct' => 'required_with:options|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();
        try {
            $question = QuestionBank::create([
                'question_text' => $request->question_text,
                'question_type' => $request->question_type,
                'marks' => $request->marks,
                'difficulty' => $request->difficulty,
                'subject_id' => $request->subject_id,
                'class_level' => $request->class_level,
                'instructions' => $request->instructions,
                'status' => $request->status,
                'created_by' => auth()->id(),
            ]);

            // Create options if needed
            if ($request->filled('options')) {
                $sortOrder = 0;
                foreach ($request->options as $option) {
                    QuestionBankOption::create([
                        'question_id' => $question->id,
                        'option_text' => $option['text'],
                        'is_correct' => $option['is_correct'] ?? false,
                        'sort_order' => $sortOrder++,
                    ]);
                }
            }

            // Create initial version
            $question->versions()->create([
                'version_number' => 1,
                'question_text' => $question->question_text,
                'question_type' => $question->question_type,
                'marks' => $question->marks,
                'difficulty' => $question->difficulty,
                'instructions' => $question->instructions,
                'created_by' => auth()->id(),
                'change_notes' => 'Initial version',
            ]);

            DB::commit();

            return response()->json($question->load(['options', 'versions']), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update question
     */
    public function update(Request $request, $id)
    {
        $question = QuestionBank::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'question_text' => 'required|string|min:5',
            'question_type' => 'required|in:multiple_choice,multiple_select,true_false,short_answer,long_answer,file_upload',
            'marks' => 'required|integer|min:1|max:1000',
            'difficulty' => 'required|in:Easy,Medium,Hard',
            'subject_id' => 'required|integer|exists:subjects,id',
            'class_level' => 'required|string',
            'status' => 'required|in:Draft,Active,Inactive,Archived',
            'instructions' => 'nullable|string',
            'options' => 'required_if:question_type,multiple_choice,multiple_select,true_false|array',
            'options.*.text' => 'required_with:options|string',
            'options.*.is_correct' => 'required_with:options|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();
        try {
            // Update question
            $question->update([
                'question_text' => $request->question_text,
                'question_type' => $request->question_type,
                'marks' => $request->marks,
                'difficulty' => $request->difficulty,
                'subject_id' => $request->subject_id,
                'class_level' => $request->class_level,
                'instructions' => $request->instructions,
                'status' => $request->status,
            ]);

            // Delete old options and recreate
            $question->options()->delete();
            if ($request->filled('options')) {
                $sortOrder = 0;
                foreach ($request->options as $option) {
                    QuestionBankOption::create([
                        'question_id' => $question->id,
                        'option_text' => $option['text'],
                        'is_correct' => $option['is_correct'] ?? false,
                        'sort_order' => $sortOrder++,
                    ]);
                }
            }

            // Create new version
            $lastVersion = $question->versions()->max('version_number') ?? 0;
            $question->versions()->create([
                'version_number' => $lastVersion + 1,
                'question_text' => $question->question_text,
                'question_type' => $question->question_type,
                'marks' => $question->marks,
                'difficulty' => $question->difficulty,
                'instructions' => $question->instructions,
                'created_by' => auth()->id(),
                'change_notes' => $request->input('change_notes', 'Updated'),
            ]);

            DB::commit();

            return response()->json($question->load(['options', 'versions']));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete question (only if unused)
     */
    public function destroy($id)
    {
        $question = QuestionBank::findOrFail($id);
        
        // Check if question is used in any exams
        // TODO: Add check for exam_questions table when ready
        
        $question->delete();
        return response()->json(['message' => 'Question deleted']);
    }

    /**
     * Bulk activate questions
     */
    public function bulkActivate(Request $request)
    {
        $ids = $request->input('ids', []);
        QuestionBank::whereIn('id', $ids)->update(['status' => 'Active']);
        return response()->json(['message' => count($ids) . ' questions activated']);
    }

    /**
     * Bulk deactivate questions
     */
    public function bulkDeactivate(Request $request)
    {
        $ids = $request->input('ids', []);
        QuestionBank::whereIn('id', $ids)->update(['status' => 'Inactive']);
        return response()->json(['message' => count($ids) . ' questions deactivated']);
    }

    /**
     * Bulk archive questions
     */
    public function bulkArchive(Request $request)
    {
        $ids = $request->input('ids', []);
        QuestionBank::whereIn('id', $ids)->update(['status' => 'Archived']);
        return response()->json(['message' => count($ids) . ' questions archived']);
    }

    /**
     * Get dashboard stats
     */
    public function stats()
    {
        return response()->json([
            'total_questions' => QuestionBank::count(),
            'active_questions' => QuestionBank::where('status', 'Active')->count(),
            'draft_questions' => QuestionBank::where('status', 'Draft')->count(),
            'by_subject' => QuestionBank::selectRaw('subject_id, count(*) as count')
                ->groupBy('subject_id')
                ->with('subject')
                ->get(),
            'by_class_level' => QuestionBank::selectRaw('class_level, count(*) as count')
                ->groupBy('class_level')
                ->get(),
            'by_type' => QuestionBank::selectRaw('question_type, count(*) as count')
                ->groupBy('question_type')
                ->get(),
        ]);
    }
}
