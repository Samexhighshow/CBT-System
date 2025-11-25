<?php

namespace App\Services;

class ExamScoringService
{
    /**
     * Score an exam's answers.
     * This is a simple example: exact match scoring for MCQs.
     * Real implementation should load correct options and apply rules (negative marking, partial credit).
     */
    public function score(int $examId, array $answers): int
    {
        // answers = [{question_id: int, option_id: int, answer_text: string|null}, ...]
        $score = 0;
        foreach ($answers as $ans) {
            if (isset($ans['is_correct']) && $ans['is_correct']) {
                $score += 1;
            }
        }
        return $score;
    }
}
