<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamDuplicationController extends Controller
{
    /**
     * Duplicate an existing exam
     */
    public function duplicate(Request $request, $examId)
    {
        $originalExam = Exam::with('questions.options')->findOrFail($examId);

        DB::beginTransaction();
        try {
            // Create new exam
            $newExam = Exam::create([
                'title' => $originalExam->title . ' (Copy)',
                'description' => $originalExam->description,
                'subject_id' => $originalExam->subject_id,
                'class_level' => $originalExam->class_level,
                'department' => $originalExam->department,
                'duration' => $originalExam->duration,
                'duration_minutes' => $originalExam->duration_minutes,
                'total_marks' => $originalExam->total_marks,
                'passing_marks' => $originalExam->passing_marks,
                'start_time' => $request->input('start_time', null),
                'end_time' => $request->input('end_time', null),
                'status' => 'draft',
                'published' => false,
                'metadata' => $originalExam->metadata,
            ]);

            // Duplicate questions and options
            foreach ($originalExam->questions as $originalQuestion) {
                $newQuestion = Question::create([
                    'exam_id' => $newExam->id,
                    'question_text' => $originalQuestion->question_text,
                    'question_type' => $originalQuestion->question_type,
                    'marks' => $originalQuestion->marks,
                    'difficulty_level' => $originalQuestion->difficulty_level,
                    'metadata' => $originalQuestion->metadata,
                ]);

                // Duplicate options
                if ($originalQuestion->options) {
                    foreach ($originalQuestion->options as $originalOption) {
                        $newQuestion->options()->create([
                            'option_text' => $originalOption->option_text,
                            'is_correct' => $originalOption->is_correct,
                        ]);
                    }
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Exam duplicated successfully',
                'exam' => $newExam->load('questions.options'),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to duplicate exam: ' . $e->getMessage(),
            ], 500);
        }
    }
}
