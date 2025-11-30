<?php

namespace App\Http\Controllers;

use App\Models\CbtQuestion;
use App\Models\CbtSubject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class CbtQuestionImportController extends Controller
{
    public function sampleCsv()
    {
        $content = "question,question_type,options,correct_answer,points\n".
            "\"What is the capital of France?\",single_choice,\"Paris|London|Rome|Berlin\",Paris,2\n".
            "\"Select the prime numbers\",multiple_choice,\"2|3|4|9|11\",\"2|3|11\",3\n".
            "\"Is the earth flat?\",true_false,\"True|False\",False,1\n".
            "\"What is 2 + 2?\",short_answer,,4,1\n".
            "\"Explain photosynthesis\",long_answer,,,10\n";
        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="cbt_sample.csv"',
        ]);
    }

    public function upload(Request $request, int $subjectId)
    {
        $subject = CbtSubject::findOrFail($subjectId);

        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', $rows[0] ?? []);
        $expected = ['question','question_type','options','correct_answer','points'];

        if ($header !== $expected) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid CSV header. Expected: '.implode(',', $expected),
            ], 422);
        }

        $inserted = 0;
        $invalid = [];

        foreach (array_slice($rows, 1) as $index => $row) {
            [$question, $type, $options, $correct, $points] = array_pad($row, 5, null);
            $line = $index + 2; // considering header line

            $data = [
                'question' => $question,
                'question_type' => $type,
                'options' => $options,
                'correct_answer' => $correct,
                'points' => $points,
            ];

            $v = Validator::make($data, [
                'question' => 'required|string',
                'question_type' => 'required|in:single_choice,multiple_choice,true_false,short_answer,long_answer',
                'points' => 'required|integer|min:0',
            ]);

            if ($v->fails()) {
                $invalid[] = [
                    'line' => $line,
                    'errors' => $v->errors()->all(),
                ];
                continue;
            }

            $optionsArray = null;
            $correctAnswer = null;

            if (in_array($type, ['single_choice','multiple_choice','true_false'])) {
                $optionsArray = $options ? array_map('trim', explode('|', $options)) : null;
                if (!$optionsArray || count($optionsArray) < 2) {
                    $invalid[] = [ 'line' => $line, 'errors' => ['Options must have at least two entries'] ];
                    continue;
                }
            }

            switch ($type) {
                case 'single_choice':
                case 'true_false':
                case 'short_answer':
                    $correctAnswer = $correct ? trim($correct) : null;
                    if (!$correctAnswer) {
                        $invalid[] = [ 'line' => $line, 'errors' => ['Correct answer required'] ];
                        continue 2;
                    }
                    break;
                case 'multiple_choice':
                    $correctAnswer = $correct ? array_map('trim', explode('|', $correct)) : [];
                    if (empty($correctAnswer)) {
                        $invalid[] = [ 'line' => $line, 'errors' => ['Correct answers required'] ];
                        continue 2;
                    }
                    break;
                case 'long_answer':
                    $correctAnswer = null; // manual grading
                    break;
            }

            CbtQuestion::create([
                'subject_id' => $subject->id,
                'question' => $question,
                'question_type' => $type,
                'options' => $optionsArray,
                'correct_answer' => $correctAnswer,
                'points' => (int) $points,
            ]);
            $inserted++;
        }

        return response()->json([
            'status' => 'ok',
            'inserted' => $inserted,
            'invalid' => $invalid,
        ]);
    }
}
