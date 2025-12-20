# PHASE 4: SERVER-SIDE VALIDATION - IMPLEMENTATION COMPLETE

## Overview
Phase 4 implements comprehensive server-side validation to ensure data integrity and enforce business rules for the question management system. All validations are performed at the backend before data is persisted to the database.

## Implemented Validations

### 1. **Exam Status Checks**

#### Prevent Adding Questions to Closed Exams
- **File**: `app/Http/Requests/StoreQuestionRequest.php`
- **Method**: `withValidator()`
- **Logic**: Validates that exam status is not 'closed' or 'completed'
- **Error**: "Cannot add questions to a closed exam"

#### Prevent Editing Questions for Closed Exams
- **File**: `app/Http/Requests/UpdateQuestionRequest.php`
- **Method**: `withValidator()`
- **Logic**: Validates that exam status allows modifications
- **Error**: "Cannot edit questions for a closed exam"

#### Helper Methods in Exam Model
```php
$exam->isClosed()                  // Check if exam is closed
$exam->isOpenForEditing()           // Check if exam can be edited
$exam->validateQuestionAddition($marks)    // Validate new question
$exam->validateQuestionUpdate($question, $newMarks)  // Validate edit
```

---

### 2. **Exam ID Validation**

#### Verify Exam Exists
- **Validation Rule**: `'exam_id' => ['required', 'integer', 'exists:exams,id']`
- **File**: Both StoreQuestionRequest and UpdateQuestionRequest
- **Error**: "The selected exam does not exist"

---

### 3. **Marks Validation**

#### Prevent Marks Exceeding Exam Total
- **Files**: 
  - `app/Http/Requests/StoreQuestionRequest.php`
  - `app/Http/Requests/UpdateQuestionRequest.php`
  - `app/Models/Exam.php`
  
- **Logic**:
  ```php
  // In Exam model
  $currentTotal = $this->getTotalMarks();
  $canAdd = ($currentTotal + $newMarks) <= $this->total_marks;
  
  // In Form Request
  if ($exam && $this->marks > $exam->total_marks) {
      $validator->errors()->add('marks', "Marks cannot exceed exam total ({$exam->total_marks})");
  }
  ```

- **Helper Methods**:
  ```php
  $exam->getTotalMarks()           // Get sum of all question marks
  $exam->getAvailableMarks()        // Get remaining marks available
  $exam->canAddMarks($newMarks)     // Check if marks can be added
  ```

---

### 4. **Multiple Choice Question Validation**

#### MCQ Single Answer (multiple_choice_single)
**Requirements**:
- Minimum 2 options required
- Exactly 1 option marked as correct
- All options must have text

**Validation**:
```php
// In StoreQuestionRequest::withValidator()
if ($this->question_type === 'multiple_choice_single') {
    $options = $this->get('options', []);
    if (count($options) < 2) {
        $validator->errors()->add('options', 'Must have at least 2 options');
    }
    
    $correctCount = collect($options)->where('is_correct', true)->count();
    if ($correctCount !== 1) {
        $validator->errors()->add('options', 'Must have exactly 1 correct option');
    }
}
```

#### MCQ Multiple Answers (multiple_choice_multiple)
**Requirements**:
- Minimum 2 options required
- At least 1 option marked as correct
- All options must have text

**Validation**: Similar to single answer, but allows multiple correct options

---

### 5. **True/False Question Validation**

**Requirements**:
- `correct_answer` must be either 'true' or 'false'
- Exactly 2 options (implicit)

**Validation**:
```php
if ($this->question_type === 'true_false') {
    if (!in_array($this->correct_answer, ['true', 'false'])) {
        $validator->errors()->add('correct_answer', 'Must be "true" or "false"');
    }
}
```

---

### 6. **Matching/Pairing Validation**

**Requirements**:
- Minimum 2 pairs
- All pairs must be complete (both left and right)
- No duplicate pairs
- No empty items

**Validation**:
```php
if ($this->question_type === 'matching') {
    $pairs = $this->get('matching_pairs', []);
    
    if (count($pairs) < 2) {
        $validator->errors()->add('matching_pairs', 'Must have at least 2 pairs');
    }
    
    foreach ($pairs as $pair) {
        if (empty($pair['left']) || empty($pair['right'])) {
            $validator->errors()->add('matching_pairs', 'All pairs must be complete');
            break;
        }
    }
}
```

#### Helper in Question Model:
```php
$question->validateMatchingPairs($pairs)  // Returns array of errors
```

---

### 7. **Fill-in-the-Blank Validation**

**Requirements**:
- Question text must contain at least one blank (indicated by `_____`)
- Number of blanks must exactly match number of answers
- All answer fields must be filled

**Validation**:
```php
if ($this->question_type === 'fill_blank') {
    $questionText = $this->question_text;
    $blankCount = substr_count($questionText, '_____');
    $answerCount = count($this->get('blank_answers', []));
    
    if ($blankCount === 0) {
        $validator->errors()->add('question_text', 'Must contain at least one blank (_____)');;
    }
    
    if ($blankCount !== $answerCount) {
        $validator->errors()->add('blank_answers', "Blanks ({$blankCount}) must match answers ({$answerCount})");
    }
}
```

#### Helper in Question Model:
```php
$question->validateFillInTheBlank($questionText, $answers)  // Returns errors
```

---

### 8. **Ordering/Sequencing Validation**

**Requirements**:
- Minimum 2 items
- All items must be non-empty
- No duplicate items

**Validation**:
```php
if ($this->question_type === 'ordering') {
    $items = $this->get('ordering_items', []);
    if (count($items) < 2) {
        $validator->errors()->add('ordering_items', 'Must have at least 2 items');
    }
}
```

#### Helper in Question Model:
```php
$question->validateOrderingItems($items)  // Returns errors
```

---

### 9. **Media-Based Questions**

#### Image-Based Questions (image_based)
- **Requirement**: `image_url` is required and must be valid URL
- **Validation**: 
  ```php
  if ($this->question_type === 'image_based' && empty($this->image_url)) {
      $validator->errors()->add('image_url', 'Image URL is required');
  }
  ```

#### Audio-Based Questions (audio_based)
- **Requirement**: `audio_url` is required and must be valid URL
- **Validation**:
  ```php
  if ($this->question_type === 'audio_based' && empty($this->audio_url)) {
      $validator->errors()->add('audio_url', 'Audio URL is required');
  }
  ```

---

### 10. **Complex Question Types**

#### Passage/Comprehension (passage)
- **Requirement**: `passage_text` is required (minimum 50 characters)
- **Validation**:
  ```php
  if ($this->question_type === 'passage' && empty($this->passage_text)) {
      $validator->errors()->add('passage_text', 'Passage text is required');
  }
  ```

#### Case Study (case_study)
- **Requirement**: `case_study_text` is required (minimum 50 characters)

#### Calculation/Formula (calculation)
- **Requirement**: `correct_answer` is required
- **Optional**: `formula` for documenting the formula

#### Practical/Scenario (practical)
- **Requirement**: `scenario_text` is required (minimum 50 characters)
- **Optional**: `marking_rubric` for grading guidelines

---

### 11. **Text-Based Questions**

#### Short Answer (short_answer) and Essay (essay)
- **Requirement**: `max_words` must be specified (10-5000 range)
- **Validation**:
  ```php
  if (in_array($this->question_type, ['short_answer', 'essay']) && empty($this->max_words)) {
      $validator->errors()->add('max_words', 'Maximum words must be specified');
  }
  ```

---

## Form Request Classes

### StoreQuestionRequest
**File**: `app/Http/Requests/StoreQuestionRequest.php`

**Validations Included**:
- Exam ID existence
- Question text requirements (10-5000 characters)
- Question type validation
- Marks validation (0.5-100)
- All optional field validations
- Type-specific array field validations
- Complete `withValidator()` for business logic

### UpdateQuestionRequest
**File**: `app/Http/Requests/UpdateQuestionRequest.php`

**Key Differences from Store**:
- Additional check for exam closed status
- Checks that exam allows editing
- Validates mark increases don't exceed limits
- Otherwise identical to Store request

---

## Model Validation Methods

### Question Model (`app/Models/Question.php`)

**Type-Specific Validators**:
```php
validateMCQOptions($options)              // Validate MCQ options
validateTrueFalseAnswer($answer)          // Validate T/F answer
validateFillInTheBlank($text, $answers)   // Validate blanks/answers
validateMatchingPairs($pairs)             // Validate pairs
validateOrderingItems($items)             // Validate ordering
validateMarksAgainstExam($marks)          // Validate marks vs exam
validateExamStatus()                      // Check exam is editable
validateAllFields($data)                  // Comprehensive validation
```

### Exam Model (`app/Models/Exam.php`)

**Status & Marks Helpers**:
```php
isClosed()                              // Check if closed
isOpenForEditing()                      // Check if editable
getTotalMarks()                         // Sum of all question marks
getAvailableMarks()                     // Remaining marks available
canAddMarks($newMarks)                  // Check if marks can be added
validateQuestionAddition($marks)        // Validate new question
validateQuestionUpdate($q, $newMarks)   // Validate edit
getQuestionsSummary()                   // Get exam structure summary
validateForPublishing()                 // Pre-publish validation
```

---

## Custom Validation Rules

**File**: `app/Rules/QuestionValidationRules.php`

Available Rules:
- `MinimumMCQOptions`
- `ExactlyOneCorrectOption`
- `AtLeastOneCorrectOption`
- `EqualMatchingPairs`
- `MatchingBlankAnswers`
- `UniqueOrderingItems`
- `ContainsBlanks`
- `ExamNotClosed`
- `MarksWithinExamLimit`
- `ValidMediaUrl`
- `MeaningfulQuestionText`

---

## Controller Updates

### QuestionController (`app/Http/Controllers/Api/QuestionController.php`)

**store() Method**:
- Uses `StoreQuestionRequest` for validation
- Additional exam validation before persisting
- Stores array-based data in JSON columns
- Returns 422 with detailed errors on validation failure

**update() Method**:
- Uses `UpdateQuestionRequest` for validation
- Validates mark changes against exam limits
- Properly handles options updates for choice types
- Preserves question_data for array fields

**Error Responses**:
```json
{
  "message": "Cannot add question to this exam",
  "errors": [
    "Cannot add questions to a closed exam",
    "Marks cannot exceed exam total marks (50)"
  ]
}
```

---

## Testing

**Test File**: `tests/Feature/Api/QuestionValidationTest.php`

**Covered Test Cases**:
1. ✅ Cannot add questions to closed exam
2. ✅ Cannot add questions with invalid exam_id
3. ✅ Marks cannot exceed exam total
4. ✅ MCQ requires minimum 2 options
5. ✅ Single MCQ requires exactly 1 correct
6. ✅ Multiple MCQ requires at least 1 correct
7. ✅ True/False answer validation
8. ✅ Matching pairs validation (count & completeness)
9. ✅ Fill-in-the-blank validation (blanks vs answers)
10. ✅ Ordering items validation (minimum count)
11. ✅ Image-based requires URL
12. ✅ Audio-based requires URL
13. ✅ Passage requires text
14. ✅ Calculation requires answer
15. ✅ Successful creation with all validations
16. ✅ Cannot edit questions for closed exam
17. ✅ Cannot increase marks beyond exam total

**Run Tests**:
```bash
php artisan test tests/Feature/Api/QuestionValidationTest.php
```

---

## API Error Examples

### Example 1: Closed Exam Error
```
POST /api/questions
Content-Type: application/json

{
  "exam_id": 1,
  "question_text": "Question?",
  "question_type": "multiple_choice_single",
  "marks": 5,
  "options": [...]
}

Response 422:
{
  "message": "Cannot add questions to a closed exam",
  "errors": {
    "exam_id": ["Cannot add questions to a closed exam"]
  }
}
```

### Example 2: Invalid MCQ Options
```
POST /api/questions
{
  "exam_id": 1,
  "question_text": "What?",
  "question_type": "multiple_choice_single",
  "marks": 5,
  "options": [
    {"option_text": "A", "is_correct": false},
    {"option_text": "B", "is_correct": false}  # No correct option!
  ]
}

Response 422:
{
  "message": "The given data was invalid",
  "errors": {
    "options": ["Multiple choice (single answer) must have exactly 1 correct option"]
  }
}
```

### Example 3: Fill-Blank Mismatch
```
POST /api/questions
{
  "exam_id": 1,
  "question_text": "The capital is _____",  # 1 blank
  "question_type": "fill_blank",
  "marks": 5,
  "blank_answers": ["Paris", "London"]  # 2 answers!
}

Response 422:
{
  "message": "The given data was invalid",
  "errors": {
    "blank_answers": ["Number of blanks (1) must match number of answers (2)"]
  }
}
```

---

## Validation Priority

Validations are applied in this order:

1. **Basic Field Validations** (required, type, length, format)
2. **Relationship Validations** (exam exists, references valid)
3. **Status Validations** (exam not closed)
4. **Marks Validations** (within exam total)
5. **Type-Specific Validations** (MCQ options, matching pairs, etc.)
6. **Business Logic Validations** (blanks match answers, etc.)

---

## Summary

Phase 4 provides **comprehensive, multi-layered validation** ensuring:
- ✅ Data integrity at the database level
- ✅ Business rule enforcement (closed exams, marks limits)
- ✅ Type-specific rule validation (MCQ options, matching pairs)
- ✅ Clear, actionable error messages
- ✅ Consistent API responses
- ✅ Full test coverage

All validations work together to prevent invalid data from being saved and provide clear feedback to API consumers.
