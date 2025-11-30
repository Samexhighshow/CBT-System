<?php

namespace App\Http\Controllers;

use App\Models\CbtQuestion;
use App\Models\CbtStudentAnswer;
use App\Models\CbtStudentExam;
use App\Models\CbtSubject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CbtExamController extends Controller
{
    // Start an exam for a student on a subject
    public function start(Request $request, int $subjectId)
    {
        $user = $request->user();
        $subject = CbtSubject::with('questions')->findOrFail($subjectId);

        // Validate shuffle rules
        $errors = $subject->validateShuffleSettings();
        if (!empty($errors)) {
            return response()->json(['status' => 'error', 'errors' => $errors], 422);
        }

        // Select questions based on shuffle toggle
        $query = CbtQuestion::where('subject_id', $subject->id);
        if ($subject->shuffle_questions) {
            $query = $query->inRandomOrder();
        } else {
            $query = $query->orderBy('id');
        }

        $selected = $query->take($subject->questions_required)->pluck('id')->toArray();

        // Create student exam
        $exam = CbtStudentExam::create([
            'student_id' => $user->id,
            'subject_id' => $subject->id,
            'selected_questions' => $selected,
            'status' => 'not_started',
        ]);

        $exam->startExam();

        return response()->json([
            'status' => 'ok',
            'exam_id' => $exam->id,
            'end_time' => $exam->end_time,
            'questions' => CbtQuestion::whereIn('id', $selected)->get(),
        ]);
    }

    // Save an answer (auto-save)
    public function saveAnswer(Request $request, int $examId, int $questionId)
    {
        $exam = CbtStudentExam::findOrFail($examId);
        if (!$exam->isInProgress()) {
            return response()->json(['status' => 'error', 'message' => 'Exam not in progress'], 422);
        }

        $question = CbtQuestion::findOrFail($questionId);
        if (!in_array($question->id, $exam->selected_questions ?? [])) {
            return response()->json(['status' => 'error', 'message' => 'Question not part of this exam'], 422);
        }

        $answer = $request->input('answer');

        $record = CbtStudentAnswer::updateOrCreate(
            ['student_exam_id' => $exam->id, 'question_id' => $question->id],
            ['answer' => $answer]
        );

        // Auto-grade when possible
        $record->autoGrade();

        return response()->json(['status' => 'ok']);
    }

    // Submit exam
    public function submit(Request $request, int $examId)
    {
        $exam = CbtStudentExam::with(['answers.question'])->findOrFail($examId);
        $exam->submitExam();
        $exam->calculateScore();

        return response()->json([
            'status' => 'ok',
            'score' => $exam->score,
            'total_marks' => $exam->total_marks,
            'percentage' => $exam->getPercentage(),
            'requires_manual_grading' => $exam->requires_manual_grading,
        ]);
    }

    // Manual grading for a long-answer question
    public function manualGrade(Request $request, int $examId, int $questionId)
    {
        $request->validate([
            'marks' => 'required|numeric|min:0',
            'feedback' => 'nullable|string'
        ]);

        $exam = CbtStudentExam::with('answers')->findOrFail($examId);
        $answer = CbtStudentAnswer::where('student_exam_id', $exam->id)
            ->where('question_id', $questionId)
            ->firstOrFail();

        $answer->manualGrade((float)$request->input('marks'), $request->input('feedback'), $request->user()->id);

        // Recompute exam totals if all long answers graded
        $exam->calculateScore();

        return response()->json(['status' => 'ok']);
    }

    // Get result breakdown for an exam
    public function resultBreakdown(Request $request, int $examId)
    {
        $exam = CbtStudentExam::with(['answers.question', 'subject'])->findOrFail($examId);
        $answers = $exam->answers->map(function ($ans) {
            return [
                'question_id' => $ans->question_id,
                'question' => $ans->question->question,
                'type' => $ans->question->question_type,
                'points' => $ans->question->points,
                'answer' => $ans->answer,
                'marks_awarded' => $ans->marks_awarded,
                'is_correct' => $ans->is_correct,
                'requires_manual' => $ans->question->requiresManualGrading(),
                'teacher_feedback' => $ans->teacher_feedback,
            ];
        });

        return response()->json([
            'status' => 'ok',
            'exam' => [
                'id' => $exam->id,
                'subject' => $exam->subject->subject_name,
                'score' => $exam->score,
                'total_marks' => $exam->total_marks,
                'percentage' => $exam->getPercentage(),
                'status' => $exam->status,
            ],
            'answers' => $answers,
        ]);
    }
}
