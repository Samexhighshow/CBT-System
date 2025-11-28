<?php

namespace App\Imports;

use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class QuestionsImport implements ToCollection, WithHeadingRow
{
    protected $examId;
    protected $subjectId;
    protected $importedCount = 0;

    public function __construct($examId, $subjectId)
    {
        $this->examId = $examId;
        $this->subjectId = $subjectId;
    }

    public function collection(Collection $rows)
    {
        DB::beginTransaction();
        try {
            foreach ($rows as $row) {
                // Create question
                $question = Question::create([
                    'exam_id' => $this->examId,
                    'subject_id' => $this->subjectId,
                    'question_text' => $row['question_text'],
                    'question_type' => $row['question_type'] ?? 'multiple_choice',
                    'marks' => $row['marks'] ?? 1,
                    'difficulty_level' => $row['difficulty_level'] ?? 'medium',
                ]);

                // Create options for multiple choice questions
                if (in_array($question->question_type, ['multiple_choice', 'true_false'])) {
                    $correctOption = (int) ($row['correct_option'] ?? 1);
                    
                    for ($i = 1; $i <= 4; $i++) {
                        $optionKey = 'option_' . $i;
                        if (isset($row[$optionKey]) && !empty($row[$optionKey])) {
                            QuestionOption::create([
                                'question_id' => $question->id,
                                'option_text' => $row[$optionKey],
                                'is_correct' => $i === $correctOption,
                            ]);
                        }
                    }
                }

                $this->importedCount++;
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function getImportedCount()
    {
        return $this->importedCount;
    }
}
