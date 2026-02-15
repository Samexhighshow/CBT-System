<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\Question;
use App\Models\ExamQuestionSelection;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class QuestionSelectionService
{
    /**
     * Generate question selection for a student
     */
    public function generateSelectionForStudent(Exam $exam, $studentId = null, $userId = null): ExamQuestionSelection
    {
        // Check if selection already exists
        $existing = ExamQuestionSelection::where('exam_id', $exam->id)
            ->where(function ($q) use ($studentId, $userId) {
                if ($studentId) {
                    $q->where('student_id', $studentId);
                } elseif ($userId) {
                    $q->where('user_id', $userId);
                }
            })
            ->first();

        if ($existing) {
            return $existing;
        }

        // Generate new selection based on exam settings
        $questionIds = $this->selectQuestions($exam, $studentId, $userId);
        $optionShuffles = $this->generateOptionShuffles($exam, $questionIds);
        
        $questions = Question::whereIn('id', $questionIds)->get();
        $totalMarks = $questions->sum('marks');
        $distributionSummary = $this->calculateDistribution($questions);

        return ExamQuestionSelection::create([
            'exam_id' => $exam->id,
            'student_id' => $studentId,
            'user_id' => $userId,
            'question_ids' => $questionIds,
            'option_shuffles' => $optionShuffles,
            'total_questions' => count($questionIds),
            'total_marks' => $totalMarks,
            'distribution_summary' => $distributionSummary,
        ]);
    }

    /**
     * Select questions based on exam configuration
     */
    protected function selectQuestions(Exam $exam, $studentId = null, $userId = null): array
    {
        // Start with all exam questions. For bank-linked questions, enforce Active bank status.
        $query = Question::with(['bankQuestion.options', 'options'])
            ->where('exam_id', $exam->id)
            ->where(function ($q) {
                $q->whereNull('bank_question_id')
                    ->orWhereHas('bankQuestion', fn ($bq) => $bq->where('status', 'Active'));
            });

        // Apply topic filters if specified
        if ($exam->topic_filters && is_array($exam->topic_filters) && count($exam->topic_filters) > 0) {
            $query->where(function ($q) use ($exam) {
                foreach ($exam->topic_filters as $topic) {
                    $q->orWhereJsonContains('topics', $topic);
                }
            });
        }

        $availableQuestions = $query->get();

        // If fixed mode, return all questions (respecting filters)
        if ($exam->question_selection_mode === 'fixed') {
            $questions = $availableQuestions->pluck('id')->toArray();
            
            // Apply shuffle if enabled
            if ($exam->shuffle_question_order || $exam->randomize_questions) {
                shuffle($questions);
            }
            
            return $questions;
        }

        // Random mode - select based on distribution
        $selectedIds = [];

        // Priority 1: Difficulty distribution
        if ($exam->difficulty_distribution) {
            $selectedIds = $this->selectByDifficulty($availableQuestions, $exam->difficulty_distribution);
        }
        // Priority 2: Marks distribution
        elseif ($exam->marks_distribution) {
            $selectedIds = $this->selectByMarks($availableQuestions, $exam->marks_distribution);
        }
        // Priority 3: Total questions to serve
        elseif ($exam->total_questions_to_serve) {
            $selectedIds = $this->selectRandom($availableQuestions, $exam->total_questions_to_serve);
        }
        // Default: All available questions
        else {
            $selectedIds = $availableQuestions->pluck('id')->toArray();
        }

        // Apply reuse policy for unique per student
        if ($exam->question_distribution === 'unique_per_student' && ($studentId || $userId)) {
            $selectedIds = $this->applyReusePolicy($exam, $selectedIds, $studentId, $userId);
        }

        // Apply shuffle if enabled
        if ($exam->shuffle_question_order || $exam->randomize_questions) {
            shuffle($selectedIds);
        }

        return $selectedIds;
    }

    /**
     * Select questions by difficulty distribution
     */
    protected function selectByDifficulty(Collection $questions, array $distribution): array
    {
        $selected = [];

        foreach ($distribution as $difficulty => $count) {
            $available = $questions
                ->filter(fn ($q) => $this->effectiveDifficulty($q) === strtolower((string) $difficulty))
                ->shuffle();
            $picked = $available->take($count)->pluck('id')->toArray();
            $selected = array_merge($selected, $picked);

            // Remove picked questions
            $questions = $questions->whereNotIn('id', $picked);
        }

        return $selected;
    }

    /**
     * Select questions by marks distribution
     */
    protected function selectByMarks(Collection $questions, array $distribution): array
    {
        $selected = [];

        foreach ($distribution as $marks => $count) {
            $available = $questions
                ->filter(fn ($q) => (int) $this->effectiveMarks($q) === (int) $marks)
                ->shuffle();
            $picked = $available->take($count)->pluck('id')->toArray();
            $selected = array_merge($selected, $picked);

            // Remove picked questions
            $questions = $questions->whereNotIn('id', $picked);
        }

        return $selected;
    }

    /**
     * Select random questions
     */
    protected function selectRandom(Collection $questions, int $count): array
    {
        return $questions->shuffle()->take($count)->pluck('id')->toArray();
    }

    /**
     * Apply reuse policy (ensure unique questions per student)
     */
    protected function applyReusePolicy(Exam $exam, array $questionIds, $studentId = null, $userId = null): array
    {
        if ($exam->question_reuse_policy === 'allow_reuse') {
            return $questionIds;
        }

        // Get previously used questions for this exam
        $usedQuestions = ExamQuestionSelection::where('exam_id', $exam->id)
            ->where(function ($q) use ($studentId, $userId) {
                if ($studentId) {
                    $q->where('student_id', '!=', $studentId);
                } elseif ($userId) {
                    $q->where('user_id', '!=', $userId);
                }
            })
            ->get()
            ->flatMap(fn($sel) => $sel->question_ids)
            ->unique()
            ->toArray();

        // Try to avoid reused questions
        $unused = array_diff($questionIds, $usedQuestions);

        // If not enough unused, supplement with least-used
        if (count($unused) < count($questionIds)) {
            $needed = count($questionIds) - count($unused);
            $leastUsed = $this->getLeastUsedQuestions($exam, $usedQuestions, $needed);
            $questionIds = array_merge($unused, $leastUsed);
        } else {
            $questionIds = array_values($unused);
        }

        return $questionIds;
    }

    /**
     * Get least used questions
     */
    protected function getLeastUsedQuestions(Exam $exam, array $excludeIds, int $count): array
    {
        return Question::where('exam_id', $exam->id)
            ->whereNotIn('id', $excludeIds)
            ->orderBy('usage_count', 'asc')
            ->orderBy(DB::raw('RAND()'))
            ->take($count)
            ->pluck('id')
            ->toArray();
    }

    /**
     * Generate option shuffles for MCQ questions
     */
    protected function generateOptionShuffles(Exam $exam, array $questionIds): ?array
    {
        if (!$exam->shuffle_option_order) {
            return null;
        }

        $shuffles = [];

        foreach ($questionIds as $questionId) {
            $question = Question::with(['options', 'bankQuestion.options'])->find($questionId);
            
            if ($question && in_array(strtolower((string) $this->effectiveQuestionType($question)), ['mcq', 'multiple_choice', 'multiple_choice_single', 'multiple_select', 'multiple_choice_multiple', 'true_false'], true)) {
                $options = $question->options->isNotEmpty() ? $question->options : ($question->bankQuestion?->options ?? collect());
                $optionIds = $options->pluck('id')->toArray();
                if (count($optionIds) < 2) {
                    continue;
                }
                shuffle($optionIds);
                $shuffles[$questionId] = $optionIds;
            }
        }

        return count($shuffles) > 0 ? $shuffles : null;
    }

    /**
     * Calculate distribution summary
     */
    protected function calculateDistribution(Collection $questions): array
    {
        $difficulty = ['easy' => 0, 'medium' => 0, 'hard' => 0];
        $byMarks = [];
        $byType = [];

        foreach ($questions as $question) {
            $diff = $this->effectiveDifficulty($question);
            if ($diff && array_key_exists($diff, $difficulty)) {
                $difficulty[$diff]++;
            }

            $marks = (int) $this->effectiveMarks($question);
            $byMarks[$marks] = ($byMarks[$marks] ?? 0) + 1;

            $type = (string) $this->effectiveQuestionType($question);
            $byType[$type] = ($byType[$type] ?? 0) + 1;
        }

        return [
            'by_difficulty' => $difficulty,
            'by_marks' => $byMarks,
            'by_type' => $byType,
        ];
    }

    /**
     * Generate preview of question selection
     */
    public function generatePreview(Exam $exam): array
    {
        // Get available questions
        $query = Question::with('bankQuestion')
            ->where('exam_id', $exam->id)
            ->where(function ($q) {
                $q->whereNull('bank_question_id')
                    ->orWhereHas('bankQuestion', fn ($bq) => $bq->where('status', 'Active'));
            });

        if ($exam->topic_filters && is_array($exam->topic_filters) && count($exam->topic_filters) > 0) {
            $query->where(function ($q) use ($exam) {
                foreach ($exam->topic_filters as $topic) {
                    $q->orWhereJsonContains('topics', $topic);
                }
            });
        }

        $availableQuestions = $query->get();
        $totalAvailable = $availableQuestions->count();

        // Calculate what would be selected
        $previewSelection = $this->simulateSelection($exam, $availableQuestions);

        $errors = [];
        $warnings = [];

        // Validate distribution
        if ($exam->difficulty_distribution) {
            $requested = array_sum($exam->difficulty_distribution);
            if ($requested > $totalAvailable) {
                $errors[] = "Requested {$requested} questions but only {$totalAvailable} available";
            }

            foreach ($exam->difficulty_distribution as $diff => $count) {
                $available = $availableQuestions
                    ->filter(fn ($q) => $this->effectiveDifficulty($q) === strtolower((string) $diff))
                    ->count();
                if ($count > $available) {
                    $errors[] = "Requested {$count} {$diff} questions but only {$available} available";
                }
            }
        }

        if ($exam->marks_distribution) {
            foreach ($exam->marks_distribution as $marks => $count) {
                $available = $availableQuestions
                    ->filter(fn ($q) => (int) $this->effectiveMarks($q) === (int) $marks)
                    ->count();
                if ($count > $available) {
                    $errors[] = "Requested {$count} questions worth {$marks} marks but only {$available} available";
                }
            }
        }

        if ($exam->total_questions_to_serve && $exam->total_questions_to_serve > $totalAvailable) {
            $errors[] = "Requested {$exam->total_questions_to_serve} questions but only {$totalAvailable} available";
        }

        return [
            'total_available' => $totalAvailable,
            'total_to_serve' => $previewSelection['count'],
            'total_marks' => $previewSelection['marks'],
            'distribution' => $previewSelection['distribution'],
            'sample_questions' => $previewSelection['sample'],
            'errors' => $errors,
            'warnings' => $warnings,
            'is_valid' => count($errors) === 0,
        ];
    }

    /**
     * Simulate selection for preview
     */
    protected function simulateSelection(Exam $exam, Collection $questions): array
    {
        $selected = $questions;

        // Apply selection logic
        if ($exam->difficulty_distribution) {
            $selected = collect();
            foreach ($exam->difficulty_distribution as $diff => $count) {
                $picked = $questions
                    ->filter(fn ($q) => $this->effectiveDifficulty($q) === strtolower((string) $diff))
                    ->take($count);
                $selected = $selected->merge($picked);
            }
        } elseif ($exam->marks_distribution) {
            $selected = collect();
            foreach ($exam->marks_distribution as $marks => $count) {
                $picked = $questions
                    ->filter(fn ($q) => (int) $this->effectiveMarks($q) === (int) $marks)
                    ->take($count);
                $selected = $selected->merge($picked);
            }
        } elseif ($exam->total_questions_to_serve) {
            $selected = $questions->take($exam->total_questions_to_serve);
        }

        $byDifficulty = ['easy' => 0, 'medium' => 0, 'hard' => 0];
        $byMarks = [];
        $byType = [];
        foreach ($selected as $question) {
            $diff = $this->effectiveDifficulty($question);
            if ($diff && isset($byDifficulty[$diff])) {
                $byDifficulty[$diff]++;
            }
            $marks = (int) $this->effectiveMarks($question);
            $byMarks[$marks] = ($byMarks[$marks] ?? 0) + 1;
            $type = (string) $this->effectiveQuestionType($question);
            $byType[$type] = ($byType[$type] ?? 0) + 1;
        }

        return [
            'count' => $selected->count(),
            'marks' => $selected->sum(fn ($q) => (int) $this->effectiveMarks($q)),
            'distribution' => [
                'by_difficulty' => $byDifficulty,
                'by_marks' => $byMarks,
                'by_type' => $byType,
            ],
            'sample' => $selected->take(5)->map(function ($q) {
                return [
                    'id' => $q->id,
                    'text' => substr((string) ($q->question_text ?? $q->bankQuestion?->question_text ?? ''), 0, 100) . '...',
                    'type' => $this->effectiveQuestionType($q),
                    'marks' => $this->effectiveMarks($q),
                    'difficulty' => $this->effectiveDifficulty($q),
                ];
            })->toArray(),
        ];
    }

    /**
     * Lock exam questions (freeze selection for all students)
     */
    public function lockExamQuestions(Exam $exam): void
    {
        $exam->update([
            'questions_locked' => true,
            'questions_locked_at' => now(),
        ]);
    }

    /**
     * Update question usage statistics
     */
    public function updateQuestionUsage(array $questionIds): void
    {
        Question::whereIn('id', $questionIds)->increment('usage_count');
        Question::whereIn('id', $questionIds)->update(['last_used_at' => now()]);
    }

    private function effectiveDifficulty($question): ?string
    {
        $raw = $question->bankQuestion?->difficulty
            ?? $question->difficulty_level
            ?? $question->difficulty
            ?? null;

        if ($raw === null) {
            return null;
        }

        $normalized = strtolower(trim((string) $raw));
        return in_array($normalized, ['easy', 'medium', 'hard'], true) ? $normalized : null;
    }

    private function effectiveMarks($question): int
    {
        if (($question->marks_override ?? null) !== null) {
            return (int) $question->marks_override;
        }

        if (($question->marks ?? null) !== null) {
            return (int) $question->marks;
        }

        if (($question->bankQuestion?->marks ?? null) !== null) {
            return (int) $question->bankQuestion->marks;
        }

        return 1;
    }

    private function effectiveQuestionType($question): string
    {
        return (string) (
            $question->bankQuestion?->question_type
            ?? $question->question_type
            ?? 'mcq'
        );
    }
}
