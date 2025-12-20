<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

/**
 * PHASE 4: Custom Validation Rules
 * Reusable rules for complex validation logic
 */

/**
 * Validate that MCQ has minimum number of options
 */
class MinimumMCQOptions implements Rule
{
    protected $minimum;

    public function __construct($minimum = 2)
    {
        $this->minimum = $minimum;
    }

    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }
        
        return count($value) >= $this->minimum;
    }

    public function message()
    {
        return "Multiple choice questions must have at least {$this->minimum} options.";
    }
}

/**
 * Validate that exactly one option is marked as correct for single-answer MCQ
 */
class ExactlyOneCorrectOption implements Rule
{
    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }

        $correctCount = 0;
        foreach ($value as $option) {
            if (!is_array($option)) {
                return false;
            }
            if (isset($option['is_correct']) && $option['is_correct'] === true) {
                $correctCount++;
            }
        }

        return $correctCount === 1;
    }

    public function message()
    {
        return 'Single answer multiple choice must have exactly 1 correct option.';
    }
}

/**
 * Validate that at least one option is marked as correct for multiple-answer MCQ
 */
class AtLeastOneCorrectOption implements Rule
{
    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }

        foreach ($value as $option) {
            if (!is_array($option)) {
                return false;
            }
            if (isset($option['is_correct']) && $option['is_correct'] === true) {
                return true;
            }
        }

        return false;
    }

    public function message()
    {
        return 'Multiple answer questions must have at least 1 correct option.';
    }
}

/**
 * Validate that matching pairs count is equal on both sides
 */
class EqualMatchingPairs implements Rule
{
    protected $leftCount;
    protected $rightCount;

    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }

        if (count($value) < 2) {
            return false;
        }

        // Check that all pairs are complete
        foreach ($value as $pair) {
            if (!is_array($pair) || !isset($pair['left']) || !isset($pair['right'])) {
                return false;
            }
            
            if (empty($pair['left']) || empty($pair['right'])) {
                return false;
            }
        }

        // Check for duplicate pairs
        $pairStrings = array_map(function($pair) {
            return $pair['left'] . '|' . $pair['right'];
        }, $value);

        return count($pairStrings) === count(array_unique($pairStrings));
    }

    public function message()
    {
        return 'Matching pairs must be valid and complete (no duplicates allowed).';
    }
}

/**
 * Validate that fill-in-the-blank has matching blanks and answers
 */
class MatchingBlankAnswers implements Rule
{
    protected $questionText;

    public function __construct($questionText)
    {
        $this->questionText = $questionText;
    }

    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }

        // Count blanks in question text
        $blankCount = substr_count($this->questionText, '_____');
        
        // Count non-empty answers
        $answerCount = count(array_filter($value, function($answer) {
            return !empty($answer);
        }));

        return $blankCount > 0 && $blankCount === $answerCount;
    }

    public function message()
    {
        $blankCount = substr_count($this->questionText, '_____');
        return "Number of blanks ({$blankCount}) must match number of answers.";
    }
}

/**
 * Validate that ordering items are unique and not empty
 */
class UniqueOrderingItems implements Rule
{
    public function passes($attribute, $value)
    {
        if (!is_array($value)) {
            return false;
        }

        if (count($value) < 2) {
            return false;
        }

        // Filter out empty items
        $filtered = array_filter($value, function($item) {
            return !empty($item);
        });

        // Check if we have fewer non-empty items than total
        if (count($filtered) !== count($value)) {
            return false;
        }

        // Check for duplicates
        $unique = array_unique($filtered);
        return count($unique) === count($filtered);
    }

    public function message()
    {
        return 'Ordering items must be unique and non-empty, with at least 2 items.';
    }
}

/**
 * Validate that question text contains required blanks for fill-in-the-blank
 */
class ContainsBlanks implements Rule
{
    protected $blankMarker;

    public function __construct($blankMarker = '_____')
    {
        $this->blankMarker = $blankMarker;
    }

    public function passes($attribute, $value)
    {
        return strpos($value, $this->blankMarker) !== false;
    }

    public function message()
    {
        return "Question text must contain at least one blank (indicated by {$this->blankMarker}).";
    }
}

/**
 * Validate that exam is not closed
 */
class ExamNotClosed implements Rule
{
    protected $examId;

    public function __construct($examId)
    {
        $this->examId = $examId;
    }

    public function passes($attribute, $value)
    {
        $exam = \App\Models\Exam::find($this->examId);
        return $exam && !$exam->isClosed();
    }

    public function message()
    {
        return 'Cannot add or edit questions for a closed exam.';
    }
}

/**
 * Validate that question marks don't exceed exam total marks
 */
class MarksWithinExamLimit implements Rule
{
    protected $examId;
    protected $currentMarks;

    public function __construct($examId, $currentMarks = 0)
    {
        $this->examId = $examId;
        $this->currentMarks = $currentMarks;
    }

    public function passes($attribute, $value)
    {
        $exam = \App\Models\Exam::find($this->examId);
        
        if (!$exam) {
            return false;
        }

        if (!isset($exam->total_marks) || $exam->total_marks === null) {
            return true; // No limit
        }

        $currentTotal = $exam->getTotalMarks() - $this->currentMarks;
        return ($currentTotal + $value) <= $exam->total_marks;
    }

    public function message()
    {
        $exam = \App\Models\Exam::find($this->examId);
        if ($exam) {
            $available = $exam->getAvailableMarks();
            return "Question marks cannot exceed available exam marks ({$available}).";
        }
        return 'Question marks exceed exam total marks.';
    }
}

/**
 * Validate that a URL is properly formatted
 */
class ValidMediaUrl implements Rule
{
    public function passes($attribute, $value)
    {
        if (empty($value)) {
            return true; // Allow empty/null
        }

        // Check if valid URL
        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            return false;
        }

        // Check file extension for common media types
        $extension = strtolower(pathinfo($value, PATHINFO_EXTENSION));
        
        $validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'ogg', 'm4a', 'webm', 'mp4'];
        
        return in_array($extension, $validExtensions);
    }

    public function message()
    {
        return 'The URL must point to a valid media file (image or audio).';
    }
}

/**
 * Validate that question text has minimum length with meaningful content
 */
class MeaningfulQuestionText implements Rule
{
    protected $minLength;

    public function __construct($minLength = 10)
    {
        $this->minLength = $minLength;
    }

    public function passes($attribute, $value)
    {
        // Check length
        if (strlen($value) < $this->minLength) {
            return false;
        }

        // Check for meaningful content (not just spaces or special characters)
        $meaningful = preg_replace('/[^a-zA-Z0-9]/', '', $value);
        return strlen($meaningful) >= $this->minLength;
    }

    public function message()
    {
        return "Question text must have meaningful content with at least {$this->minLength} characters.";
    }
}
