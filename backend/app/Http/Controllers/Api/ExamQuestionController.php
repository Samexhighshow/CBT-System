<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\BankQuestion;
use App\Models\BankQuestionVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamQuestionController extends Controller
{
    public function index(Exam $exam)
    {
        $items = ExamQuestion::with(['bankQuestion.subject'])
            ->where('exam_id', $exam->id)
            ->orderBy('order_index')
            ->get();

        return response()->json($items);
    }

    public function store(Request $request, Exam $exam)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.bank_question_id' => 'required|exists:bank_questions,id',
            'items.*.version_number' => 'nullable|integer',
            'items.*.marks_override' => 'nullable|integer|min:0',
        ]);

        // Enforce business rules: subject alignment, exclude Archived; warn for Draft/Inactive
        $archived = [];
        $warnings = [];
        $subjectMismatch = [];
        $classMismatch = [];
        $examClassLevel = $exam->class_level
            ?? optional($exam->schoolClass)->name
            ?? optional($exam->classLevel)->name;
        foreach ($data['items'] as $item) {
            $bankQ = BankQuestion::findOrFail($item['bank_question_id']);
            // Subject alignment: require question.subject_id to equal exam.subject_id
            if ((int)($bankQ->subject_id ?? 0) !== (int)$exam->subject_id) {
                $subjectMismatch[] = $bankQ->id;
            }
            if ($examClassLevel) {
                if (!$bankQ->class_level || strcasecmp($bankQ->class_level, $examClassLevel) !== 0) {
                    $classMismatch[] = $bankQ->id;
                }
            }
            if (strcasecmp($bankQ->status, 'Archived') === 0) {
                $archived[] = $bankQ->id;
            } elseif (in_array($bankQ->status, ['Draft', 'Inactive'], true)) {
                $warnings[] = [
                    'id' => $bankQ->id,
                    'status' => $bankQ->status,
                    'message' => "Question {$bankQ->id} is {$bankQ->status} and may need review before exam."
                ];
            }
        }

        if (!empty($archived) || !empty($subjectMismatch) || !empty($classMismatch)) {
            $errors = [];
            if (!empty($archived)) {
                $errors['archived'] = $archived;
            }
            if (!empty($subjectMismatch)) {
                $errors['subject_mismatch'] = $subjectMismatch;
            }
            if (!empty($classMismatch)) {
                $errors['class_mismatch'] = $classMismatch;
            }
            return response()->json([
                'message' => 'Some questions cannot be added due to validation errors.',
                'errors' => $errors,
            ], 422);
        }

        $created = [];
        DB::transaction(function () use ($data, $exam, &$created) {
            $maxOrder = (int) ExamQuestion::where('exam_id', $exam->id)->max('order_index');

            foreach ($data['items'] as $i => $item) {
                $bankQ = BankQuestion::findOrFail($item['bank_question_id']);

                $version = $item['version_number'] ?? optional($bankQ->versions()->first())->version_number ?? 1;

                $created[] = ExamQuestion::create([
                    'exam_id' => $exam->id,
                    'bank_question_id' => $bankQ->id,
                    'version_number' => $version,
                    'order_index' => $maxOrder + $i + 1,
                    'marks_override' => $item['marks_override'] ?? null,
                ]);
            }
        });

        return response()->json(['message' => 'Questions added', 'items' => $created, 'warnings' => $warnings], 201);
    }

    public function update(Request $request, Exam $exam, ExamQuestion $question)
    {
        abort_unless($question->exam_id === $exam->id, 404);

        $payload = $request->validate([
            'marks_override' => 'nullable|integer|min:0',
        ]);

        $question->update($payload);

        return response()->json($question->refresh());
    }

    public function reorder(Request $request, Exam $exam)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:exam_questions,id',
            'items.*.order_index' => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($data, $exam) {
            foreach ($data['items'] as $item) {
                ExamQuestion::where('id', $item['id'])->where('exam_id', $exam->id)
                    ->update(['order_index' => $item['order_index']]);
            }
        });

        return response()->json(['message' => 'Order updated']);
    }

    public function destroy(Exam $exam, ExamQuestion $question)
    {
        abort_unless($question->exam_id === $exam->id, 404);
        $question->delete();
        return response()->json(['message' => 'Removed']);
    }
}
