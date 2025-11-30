<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\QuestionsImport;

class QuestionController extends Controller
{
    /**
     * Display a listing of questions
     */
    public function index(Request $request)
    {
        $query = Question::with(['exam', 'options']);

        // Filter by subject
        // Subject filtering not supported (no subject relation/column)

        // Filter by exam
        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter by question type
        if ($request->has('question_type')) {
            $query->where('question_type', $request->question_type);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('question_text', 'like', "%{$search}%");
        }

        $questions = $query->orderBy('created_at', 'desc')->get();

        return response()->json($questions);
    }

    /**
     * Display the specified question
     */
    public function show($id)
    {
        $question = Question::with(['exam', 'options'])->findOrFail($id);
        
        return response()->json($question);
    }

    /**
     * Store a newly created question
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            // Subject not stored on questions; remove validation
            'question_text' => 'required|string',
            'question_type' => 'required|in:multiple_choice,true_false,short_answer,essay',
            'marks' => 'required|integer|min:1',
            'difficulty_level' => 'nullable|in:easy,medium,hard',
            'options' => 'required_if:question_type,multiple_choice,true_false|array|min:2',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
        ]);

        DB::beginTransaction();
        try {
            $options = $validated['options'];
            unset($validated['options']);

            $question = Question::create($validated);

            // Create options
            foreach ($options as $option) {
                $question->options()->create($option);
            }

            DB::commit();

            return response()->json([
                'message' => 'Question created successfully',
                'question' => $question->load('options')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create question', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update the specified question
     */
    public function update(Request $request, $id)
    {
        $question = Question::findOrFail($id);

        $validated = $request->validate([
            'exam_id' => 'sometimes|exists:exams,id',
            // Subject not stored on questions
            'question_text' => 'sometimes|string',
            'question_type' => 'sometimes|in:multiple_choice,true_false,short_answer,essay',
            'marks' => 'sometimes|integer|min:1',
            'difficulty_level' => 'nullable|in:easy,medium,hard',
            'options' => 'sometimes|array|min:2',
            'options.*.id' => 'sometimes|exists:question_options,id',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
        ]);

        DB::beginTransaction();
        try {
            if (isset($validated['options'])) {
                $options = $validated['options'];
                unset($validated['options']);

                // Delete old options not in the new list
                $newOptionIds = collect($options)->pluck('id')->filter();
                $question->options()->whereNotIn('id', $newOptionIds)->delete();

                // Update or create options
                foreach ($options as $option) {
                    if (isset($option['id'])) {
                        QuestionOption::where('id', $option['id'])->update([
                            'option_text' => $option['option_text'],
                            'is_correct' => $option['is_correct'],
                        ]);
                    } else {
                        $question->options()->create($option);
                    }
                }
            }

            $question->update($validated);

            DB::commit();

            return response()->json([
                'message' => 'Question updated successfully',
                'question' => $question->load('options')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update question', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified question
     */
    public function destroy($id)
    {
        $question = Question::findOrFail($id);
        $question->delete();

        return response()->json([
            'message' => 'Question deleted successfully'
        ]);
    }

    /**
     * Bulk create questions
     */
    public function bulkCreate(Request $request)
    {
        $validated = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'subject_id' => 'required|exists:subjects,id',
            'questions' => 'required|array|min:1',
            'questions.*.question_text' => 'required|string',
            'questions.*.question_type' => 'required|in:multiple_choice,true_false,short_answer,essay',
            'questions.*.marks' => 'required|integer|min:1',
            'questions.*.difficulty_level' => 'nullable|in:easy,medium,hard',
            'questions.*.options' => 'required_if:questions.*.question_type,multiple_choice,true_false|array|min:2',
            'questions.*.options.*.option_text' => 'required|string',
            'questions.*.options.*.is_correct' => 'required|boolean',
        ]);

        DB::beginTransaction();
        try {
            $createdQuestions = [];

            foreach ($validated['questions'] as $questionData) {
                $options = $questionData['options'] ?? [];
                unset($questionData['options']);

                $questionData['exam_id'] = $validated['exam_id'];
                $questionData['subject_id'] = $validated['subject_id'];

                $question = Question::create($questionData);

                // Create options
                foreach ($options as $option) {
                    $question->options()->create($option);
                }

                $createdQuestions[] = $question->load('options');
            }

            DB::commit();

            return response()->json([
                'message' => count($createdQuestions) . ' questions created successfully',
                'questions' => $createdQuestions
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create questions', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Import questions from CSV/Excel
     */
    public function importQuestions(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls',
            'exam_id' => 'required|exists:exams,id',
            'subject_id' => 'required|exists:subjects,id',
        ]);

        try {
            $import = new QuestionsImport($validated['exam_id'], $validated['subject_id']);
            Excel::import($import, $request->file('file'));

            return response()->json([
                'message' => 'Questions imported successfully',
                'imported_count' => $import->getImportedCount(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to import questions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download CSV template for question import
     */
    public function downloadTemplate()
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="questions_template.csv"',
        ];

        $columns = [
            'question_text',
            'question_type',
            'marks',
            'difficulty_level',
            'option_1',
            'option_2',
            'option_3',
            'option_4',
            'correct_option',
        ];

        $callback = function() use ($columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);
            
            // Add sample row
            fputcsv($file, [
                'What is the capital of Nigeria?',
                'multiple_choice',
                '2',
                'easy',
                'Lagos',
                'Abuja',
                'Kano',
                'Port Harcourt',
                '2', // Index of correct option (Abuja)
            ]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export questions to CSV
     */
    public function exportQuestions(Request $request)
    {
        $query = Question::with(['options', 'exam']);

        if ($request->has('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Subject filter not supported

        $questions = $query->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="questions_export.csv"',
        ];

        $callback = function() use ($questions) {
            $file = fopen('php://output', 'w');
            
            // Header row
            fputcsv($file, [
                'ID',
                'Question Text',
                'Type',
                'Marks',
                'Difficulty',
                'Subject',
                'Exam',
                'Option 1',
                'Option 2',
                'Option 3',
                'Option 4',
                'Correct Option',
            ]);

            foreach ($questions as $question) {
                $options = $question->options->pluck('option_text')->toArray();
                $correctIndex = $question->options->search(fn($opt) => $opt->is_correct) + 1;

                fputcsv($file, [
                    $question->id,
                    $question->question_text,
                    $question->question_type,
                    $question->marks,
                    $question->difficulty_level ?? 'medium',
                    '',
                    $question->exam->title ?? '',
                    $options[0] ?? '',
                    $options[1] ?? '',
                    $options[2] ?? '',
                    $options[3] ?? '',
                    $correctIndex,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
