<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;
use App\Models\Student;

class Exam extends Model
{
    protected $table = 'exams';
    
    protected $fillable = [
        'title', 
        'description', 
        'subject_id', 
        'class_id',
        'class_level_id',
        'class_level', 
        'department', 
        'duration_minutes',
        'allowed_attempts',
        'randomize_questions',
        'randomize_options',
        'navigation_mode',
        'start_time', 
        'end_time', 
        'start_datetime',
        'end_datetime',
        'status',
        'results_released',
        'published', 
        'metadata',
        'shuffle_questions',
        'seat_numbering',
        'enforce_adjacency_rules',
        'allocation_config'
    ];

    protected $casts = [
        'published' => 'boolean',
        'results_released' => 'boolean',
        'metadata' => 'array',
        'allocation_config' => 'array',
        'shuffle_questions' => 'boolean',
        'enforce_adjacency_rules' => 'boolean',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'start_datetime' => 'datetime',
        'end_datetime' => 'datetime',
        'randomize_questions' => 'boolean',
        'randomize_options' => 'boolean',
        'allowed_attempts' => 'integer',
    ];

    /**
     * Get the subject this exam belongs to
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    /**
     * Academic Management style: class level reference
     */
    public function classLevel(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_level_id');
    }

    /**
     * Get the class this exam is for
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    /**
     * Get questions for this exam (from exam_questions pivot)
     */
    public function questions()
    {
        return $this->hasMany(Question::class, 'exam_id');
    }

    /**
     * Get question pools for this exam (Phase 7)
     */
    public function questionPools()
    {
        return $this->hasMany(QuestionPool::class, 'exam_id');
    }

    /**
     * Get exam attempts
     */
    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    /**
     * Check if exam is currently active (within start and end time)
     */
    public function isActive(): bool
    {
        $now = Carbon::now();
        $start = $this->start_datetime ?? $this->start_time;
        $end = $this->end_datetime ?? $this->end_time;

        return $this->status === 'active' 
            && ($start === null || $now->gte($start))
            && ($end === null || $now->lte($end));
    }

    /**
     * Check if exam has started
     */
    public function hasStarted(): bool
    {
        $start = $this->start_datetime ?? $this->start_time;
        return $start !== null && Carbon::now()->gte($start);
    }

    /**
     * Check if exam has ended
     */
    public function hasEnded(): bool
    {
        $end = $this->end_datetime ?? $this->end_time;
        return $end !== null && Carbon::now()->gt($end);
    }

    /**
     * Check if student can access this exam
     * 
     * @param Student $student
     * @return bool
     */
    public function canStudentAccess(Student $student): bool
    {
        // Check if exam is published
        if (!$this->published) {
            return false;
        }

        // Check if exam status allows access
        if (!in_array($this->status, ['scheduled', 'active'])) {
            return false;
        }

        // Check if student is in the correct class
        if ($this->class_id && $student->class_id !== $this->class_id) {
            return false;
        }

        // Check if student is assigned to the subject
        if ($this->subject_id) {
            $hasSubject = $student->subjects()->where('subject_id', $this->subject_id)->exists();
            if (!$hasSubject) {
                return false;
            }
        }

        // Check time restrictions
        $start = $this->start_datetime ?? $this->start_time;
        $end = $this->end_datetime ?? $this->end_time;

        if ($start && Carbon::now()->lt($start)) {
            return false;
        }

        if ($end && Carbon::now()->gt($end)) {
            return false;
        }

        return true;
    }

    /**
     * PHASE 7: Comprehensive eligibility check with detailed reasons
     * Returns array with eligibility status and detailed reason if denied
     * 
     * @param Student $student
     * @return array
     */
    public function checkEligibility(Student $student): array
    {
        // 1. Check if exam is published
        if (!$this->published) {
            return [
                'eligible' => false,
                'reason' => 'exam_not_published',
                'message' => 'This exam is not yet published. Please wait for the instructor to publish it.',
                'details' => null
            ];
        }

        // 2. Check exam status
        if (!in_array($this->status, ['scheduled', 'active'])) {
            $statusMessages = [
                'draft' => 'This exam is still in draft mode.',
                'completed' => 'This exam has been closed.',
                'cancelled' => 'This exam has been cancelled.'
            ];
            return [
                'eligible' => false,
                'reason' => 'invalid_exam_status',
                'message' => $statusMessages[$this->status] ?? 'Exam status does not allow access.',
                'details' => ['status' => $this->status]
            ];
        }

        // 3. Check time window - verify current time is within exam schedule
        $start = $this->start_datetime ?? $this->start_time;
        $end = $this->end_datetime ?? $this->end_time;
        $now = Carbon::now();

        if ($start && $now->lt($start)) {
            return [
                'eligible' => false,
                'reason' => 'exam_not_started',
                'message' => 'This exam has not started yet.',
                'details' => [
                    'start_time' => $start->toDateTimeString(),
                    'time_remaining' => $now->diffInMinutes($start) . ' minutes'
                ]
            ];
        }

        if ($end && $now->gt($end)) {
            return [
                'eligible' => false,
                'reason' => 'exam_ended',
                'message' => 'This exam has ended.',
                'details' => [
                    'end_time' => $end->toDateTimeString(),
                    'ended_ago' => $end->diffInMinutes($now) . ' minutes ago'
                ]
            ];
        }

        // 4. Verify student belongs to exam's class level
        if ($this->class_id && $student->class_id !== $this->class_id) {
            $examClass = $this->schoolClass;
            $studentClass = $student->schoolClass;
            return [
                'eligible' => false,
                'reason' => 'class_mismatch',
                'message' => 'This exam is not for your class level.',
                'details' => [
                    'required_class' => $examClass ? $examClass->name : 'Unknown',
                    'your_class' => $studentClass ? $studentClass->name : 'Unknown'
                ]
            ];
        }

        // 5. Verify subject belongs to student's class
        if ($this->subject_id) {
            $hasSubject = $student->subjects()->where('subject_id', $this->subject_id)->exists();
            if (!$hasSubject) {
                $examSubject = $this->subject;
                return [
                    'eligible' => false,
                    'reason' => 'subject_not_assigned',
                    'message' => 'You are not enrolled in this subject.',
                    'details' => [
                        'subject' => $examSubject ? $examSubject->name : 'Unknown'
                    ]
                ];
            }
        }

        // 6. Check remaining attempts (if retake is enabled)
        $allowedAttempts = $this->allowed_attempts ?? 1;
        $attemptCount = $this->attempts()->where('student_id', $student->id)->count();
        
        if ($attemptCount >= $allowedAttempts) {
            return [
                'eligible' => false,
                'reason' => 'max_attempts_reached',
                'message' => 'You have reached the maximum number of attempts for this exam.',
                'details' => [
                    'attempts_taken' => $attemptCount,
                    'max_attempts' => $allowedAttempts
                ]
            ];
        }

        // All checks passed
        return [
            'eligible' => true,
            'reason' => null,
            'message' => 'You are eligible to take this exam.',
            'details' => [
                'attempts_remaining' => $allowedAttempts - $attemptCount,
                'duration_minutes' => $this->duration_minutes,
                'start_time' => $start ? $start->toDateTimeString() : null,
                'end_time' => $end ? $end->toDateTimeString() : null
            ]
        ];
    }

    /**
     * Scope to only get published exams
     */
    public function scopePublished($query)
    {
        return $query->where('published', true);
    }

    /**
     * Scope to get active exams (within time range)
     */
    public function scopeActive($query)
    {
        $now = Carbon::now();
        return $query->where('status', 'active')
            ->where(function ($q) use ($now) {
                $q->where(function ($qq) use ($now) {
                    $qq->whereNull('start_datetime')
                       ->orWhere('start_datetime', '<=', $now);
                })
                ->orWhere(function ($qq) use ($now) {
                    $qq->whereNull('start_time')
                       ->orWhere('start_time', '<=', $now);
                });
            })
            ->where(function ($q) use ($now) {
                $q->where(function ($qq) use ($now) {
                    $qq->whereNull('end_datetime')
                       ->orWhere('end_datetime', '>=', $now);
                })
                ->orWhere(function ($qq) use ($now) {
                    $qq->whereNull('end_time')
                       ->orWhere('end_time', '>=', $now);
                });
            });
    }

    /**
     * Scope to filter by class
     */
    public function scopeForClass($query, $classId)
    {
        return $query->where('class_id', $classId);
    }

    /**
     * Scope to filter by subject
     */
    public function scopeForSubject($query, $subjectId)
    {
        return $query->where('subject_id', $subjectId);
    }

    /**
     * PHASE 4 VALIDATION HELPERS
     */

    /**
     * Check if exam is closed (prevents adding/editing questions)
     */
    public function isClosed(): bool
    {
        return $this->status === 'closed' || $this->status === 'completed';
    }

    /**
     * Check if exam is open for editing questions
     */
    public function isOpenForEditing(): bool
    {
        return !$this->isClosed() && in_array($this->status, ['draft', 'scheduled']);
    }

    /**
     * Get the total marks for this exam
     */
    public function getTotalMarks(): float
    {
        return (float) $this->questions()->sum('marks');
    }

    /**
     * Calculate the current total of question marks
     */
    public function getCurrentMarksTotal(): float
    {
        return $this->getTotalMarks();
    }

    /**
     * Check if a new question's marks would exceed the exam total
     */
    public function canAddMarks(float $newMarks): bool
    {
        $currentTotal = $this->getTotalMarks();
        
        // If exam has no maximum marks limit, allow it
        if (!isset($this->total_marks) || $this->total_marks === null) {
            return true;
        }

        return ($currentTotal + $newMarks) <= $this->total_marks;
    }

    /**
     * Get available marks remaining for the exam
     */
    public function getAvailableMarks(): float
    {
        if (!isset($this->total_marks) || $this->total_marks === null) {
            return PHP_FLOAT_MAX;
        }

        return max(0, $this->total_marks - $this->getTotalMarks());
    }

    /**
     * Validate if exam can accept a new question with given marks
     */
    public function validateQuestionAddition(float $marks): array
    {
        $errors = [];

        // Check if exam is closed
        if ($this->isClosed()) {
            $errors[] = 'Cannot add questions to a closed exam';
        }

        // Check marks
        if ($marks <= 0) {
            $errors[] = 'Question marks must be greater than 0';
        }

        if (isset($this->total_marks) && $this->total_marks !== null) {
            if (!$this->canAddMarks($marks)) {
                $currentTotal = $this->getTotalMarks();
                $errors[] = "Adding {$marks} marks would exceed exam total ({$currentTotal} + {$marks} > {$this->total_marks})";
            }
        }

        return $errors;
    }

    /**
     * Validate if exam can accept an updated question with new marks
     */
    public function validateQuestionUpdate(Question $question, float $newMarks): array
    {
        $errors = [];

        // Check if exam is closed
        if ($this->isClosed()) {
            $errors[] = 'Cannot edit questions for a closed exam';
        }

        // Check marks
        if ($newMarks <= 0) {
            $errors[] = 'Question marks must be greater than 0';
        }

        if (isset($this->total_marks) && $this->total_marks !== null) {
            $currentTotal = $this->getTotalMarks();
            $marksDifference = $newMarks - $question->marks;
            
            if ($marksDifference > 0 && ($currentTotal + $marksDifference) > $this->total_marks) {
                $errors[] = "Updating marks to {$newMarks} would exceed exam total ({$currentTotal} + {$marksDifference} > {$this->total_marks})";
            }
        }

        return $errors;
    }

    /**
     * Get summary of exam questions and marks
     */
    public function getQuestionsSummary(): array
    {
        $allQuestions = $this->questions()->get();
        
        return [
            'total_questions' => $allQuestions->count(),
            'total_marks' => $this->getTotalMarks(),
            'by_type' => $allQuestions->groupBy('question_type')->mapWithKeys(function ($questions, $type) {
                return [
                    $type => [
                        'count' => $questions->count(),
                        'marks' => $questions->sum('marks')
                    ]
                ];
            })->toArray(),
            'by_difficulty' => $allQuestions->groupBy('difficulty_level')->mapWithKeys(function ($questions, $level) {
                return [
                    $level => [
                        'count' => $questions->count(),
                        'marks' => $questions->sum('marks')
                    ]
                ];
            })->toArray(),
        ];
    }

    /**
     * Validate entire exam structure before publishing
     */
    public function validateForPublishing(): array
    {
        $errors = [];

        // Check if exam has questions
        if ($this->questions()->count() === 0) {
            $errors[] = 'Exam must have at least one question before publishing';
        }

        // Check if all questions are valid
        foreach ($this->questions()->get() as $question) {
            if (!empty($errors)) {
                break; // Stop after first invalid question found
            }
        }

        // Check if exam has duration set
        if (!$this->duration_minutes || $this->duration_minutes <= 0) {
            $errors[] = 'Exam duration must be set (greater than 0 minutes)';
        }

        // Check time window
        if ($this->start_datetime && $this->end_datetime) {
            if ($this->end_datetime <= $this->start_datetime) {
                $errors[] = 'Exam end time must be after start time';
            }
        }

        return $errors;
    }

    /**
     * PHASE 5: Admin Actions Helper Methods
     */

    /**
     * Get questions with options
     */
    public function questionsWithOptions()
    {
        return $this->questions()->with(['options'])->orderBy('order_index')->get();
    }

    /**
     * Get exam statistics
     */
    public function getStatistics(): array
    {
        $questions = $this->questions()->get();

        return [
            'total_questions' => $questions->count(),
            'total_marks' => $questions->sum('marks'),
            'active_questions' => $questions->where('status', 'active')->count(),
            'disabled_questions' => $questions->where('status', 'disabled')->count(),
            'draft_questions' => $questions->where('status', 'draft')->count(),
            'by_type' => $questions->groupBy('question_type')
                ->map(fn($group) => [
                    'count' => $group->count(),
                    'marks' => $group->sum('marks')
                ])->toArray(),
        ];
    }

    /**
     * Check if can delete a question
     */
    public function canDeleteQuestion(Question $question): bool
    {
        return !$this->isClosed();
    }

    /**
     * Check if can edit a question
     */
    public function canEditQuestion(Question $question): bool
    {
        return !$this->isClosed();
    }

    /**
     * Check if can duplicate a question
     */
    public function canDuplicateQuestion(Question $question): bool
    {
        return !$this->isClosed();
    }

    /**
     * Get preview of question as student would see
     */
    public function previewQuestion(Question $question)
    {
        return [
            'id' => $question->id,
            'text' => $question->question_text,
            'type' => $question->question_type,
            'marks' => $question->marks,
            'options' => $this->randomize_options 
                ? $question->options->shuffle() 
                : $question->options
        ];
    }

    /**
     * Get questions grouped by type
     */
    public function getQuestionsByType()
    {
        return $this->questions()
            ->with(['options'])
            ->get()
            ->groupBy('question_type')
            ->mapWithKeys(function ($questions, $type) {
                return [
                    $type => [
                        'count' => $questions->count(),
                        'marks' => $questions->sum('marks'),
                        'questions' => $questions->values(),
                    ]
                ];
            });
    }

    /**
     * Get questions grouped by difficulty
     */
    public function getQuestionsByDifficulty()
    {
        return $this->questions()
            ->with(['options'])
            ->get()
            ->groupBy('difficulty_level')
            ->mapWithKeys(function ($questions, $level) {
                return [
                    $level ?? 'unset' => [
                        'count' => $questions->count(),
                        'marks' => $questions->sum('marks'),
                        'questions' => $questions->values(),
                    ]
                ];
            });
    }
}

