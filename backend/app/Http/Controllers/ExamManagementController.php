<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Option;

class ExamManagementController extends Controller
{
    public function store(Request $request)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'title' => 'required|unique:exams',
            'description' => 'nullable',
            'class_level' => 'required|in:JSS,SSS',
            'department' => 'nullable|string',
            'duration_minutes' => 'required|integer|min:5|max:480',
            'metadata' => 'nullable|array'
        ]);

        $exam = Exam::create(array_merge($data, ['published' => false]));
        return response()->json(['exam' => $exam], 201);
    }

    public function update(Request $request, $id)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $exam = Exam::findOrFail($id);
        $data = $request->validate([
            'title' => 'required|unique:exams,title,' . $id,
            'description' => 'nullable',
            'duration_minutes' => 'required|integer|min:5|max:480',
            'published' => 'boolean'
        ]);

        $exam->update($data);
        return response()->json(['exam' => $exam]);
    }

    public function publish($id)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $exam = Exam::findOrFail($id);
        $exam->update(['published' => true]);
        return response()->json(['message' => 'Exam published', 'exam' => $exam]);
    }

    public function addQuestion(Request $request, $examId)
    {
        if (!auth()->user()->hasRole(['Admin', 'Sub-Admin', 'Teacher'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'question_text' => 'required',
            'question_type' => 'required|in:mcq,text,essay',
            'options' => 'required_if:question_type,mcq|array'
        ]);

        $exam = Exam::findOrFail($examId);
        $question = $exam->questions()->create([
            'question_text' => $data['question_text'],
            'question_type' => $data['question_type']
        ]);

        if ($data['question_type'] === 'mcq' && isset($data['options'])) {
            foreach ($data['options'] as $option) {
                Option::create([
                    'question_id' => $question->id,
                    'option_text' => $option['text'],
                    'is_correct' => $option['is_correct'] ?? false
                ]);
            }
        }

        return response()->json(['question' => $question->load('options')], 201);
    }

    public function destroy($id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Exam::findOrFail($id)->delete();
        return response()->json(['message' => 'Exam deleted']);
    }
}
