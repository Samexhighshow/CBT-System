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
        // Start with all exam questions
        $query = Question::where('exam_id', $exam->id)
            ->where('status', 'active')
            ->where('is_archived', false);

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
            if ($exam->shuffle_question_order) {
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
        if ($exam->shuffle_question_order) {
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
            $available = $questions->where('difficulty_level', $difficulty)->shuffle();
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
            $available = $questions->where('marks', (int)$marks)->shuffle();
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
            ->whereIn('id', $excludeIds)
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
            $question = Question::with('options')->find($questionId);
            
            if ($question && in_array($question->question_type, ['mcq', 'multiple_choice', 'multiple_response'])) {
                $optionIds = $question->options->pluck('id')->toArray();
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
        return [
            'by_difficulty' => [
                'easy' => $questions->where('difficulty_level', 'easy')->count(),
                'medium' => $questions->where('difficulty_level', 'medium')->count(),
                'hard' => $questions->where('difficulty_level', 'hard')->count(),
            ],
            'by_marks' => $questions->groupBy('marks')->map->count()->toArray(),
            'by_type' => $questions->groupBy('question_type')->map->count()->toArray(),
        ];
    }

    /**
     * Generate preview of question selection
     */
    public function generatePreview(Exam $exam): array
    {
        // Get available questions
        $query = Question::where('exam_id', $exam->id)
            ->where('status', 'active')
            ->where('is_archived', false);

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
                $available = $availableQuestions->where('difficulty_level', $diff)->count();
                if ($count > $available) {
                    $errors[] = "Requested {$count} {$diff} questions but only {$available} available";
                }
            }
        }

        if ($exam->marks_distribution) {
            foreach ($exam->marks_distribution as $marks => $count) {
                $available = $availableQuestions->where('marks', (int)$marks)->count();
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
                $picked = $questions->where('difficulty_level', $diff)->take($count);
                $selected = $selected->merge($picked);
            }
        } elseif ($exam->marks_distribution) {
            $selected = collect();
            foreach ($exam->marks_distribution as $marks => $count) {
                $picked = $questions->where('marks', (int)$marks)->take($count);
                $selected = $selected->merge($picked);
            }
        } elseif ($exam->total_questions_to_serve) {
            $selected = $questions->take($exam->total_questions_to_serve);
        }

        return [
            'count' => $selected->count(),
            'marks' => $selected->sum('marks'),
            'distribution' => [
                'by_difficulty' => [
                    'easy' => $selected->where('difficulty_level', 'easy')->count(),
                    'medium' => $selected->where('difficulty_level', 'medium')->count(),
                    'hard' => $selected->where('difficulty_level', 'hard')->count(),
                ],
                'by_marks' => $selected->groupBy('marks')->map->count()->toArray(),
                'by_type' => $selected->groupBy('question_type')->map->count()->toArray(),
            ],
            'sample' => $selected->take(5)->map(function ($q) {
                return [
                    'id' => $q->id,
                    'text' => substr($q->question_text, 0, 100) . '...',
                    'type' => $q->question_type,
                    'marks' => $q->marks,
                    'difficulty' => $q->difficulty_level,
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
}
