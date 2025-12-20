# PHASE 4: VALIDATION FLOW & ARCHITECTURE

## Request Validation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     API REQUEST RECEIVED                             │
│              POST /api/questions or PUT /api/questions/{id}          │
└──────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│            LARAVEL REQUEST VALIDATION (FormRequest)                  │
│  StoreQuestionRequest::rules() / UpdateQuestionRequest::rules()     │
├─────────────────────────────────────────────────────────────────────┤
│ • exam_id: required, exists:exams,id                                │
│ • question_text: required, string, min:10, max:5000                 │
│ • question_type: required, in:[14 types]                            │
│ • marks: required, numeric, min:0.5, max:100                        │
│ • Conditional arrays: options, blank_answers, matching_pairs, etc.  │
│                                                                       │
│ ❌ FAIL → Return 422 with field errors                              │
│ ✅ PASS → Continue to withValidator()                               │
└──────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│         BUSINESS LOGIC VALIDATION (withValidator callback)           │
│              Additional validation after basic rules pass            │
├─────────────────────────────────────────────────────────────────────┤
│ 1. EXAM STATUS CHECK                                                │
│    $exam = Exam::find($this->exam_id)                               │
│    if ($exam->isClosed()) → Error: "Cannot add to closed exam"      │
│                                                                       │
│ 2. MARKS VALIDATION                                                 │
│    if ($exam && $this->marks > $exam->total_marks)                  │
│    → Error: "Marks cannot exceed exam total"                        │
│                                                                       │
│ 3. TYPE-SPECIFIC VALIDATION                                         │
│    switch ($this->question_type):                                   │
│      - multiple_choice_single: exactly 1 correct                    │
│      - multiple_choice_multiple: at least 1 correct                 │
│      - true_false: answer is 'true' or 'false'                      │
│      - fill_blank: blanks count = answers count                     │
│      - matching: at least 2 complete pairs                          │
│      - ordering: at least 2 unique items                            │
│      - image_based: image_url required                              │
│      - audio_based: audio_url required                              │
│      - passage: passage_text required                               │
│      - case_study: case_study_text required                         │
│      - calculation: correct_answer required                         │
│      - practical: scenario_text required                            │
│      - short_answer/essay: max_words required                       │
│                                                                       │
│ ❌ FAIL → Return 422 with detailed errors                           │
│ ✅ PASS → Continue to Controller::store/update                      │
└──────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                CONTROLLER METHOD EXECUTION                           │
│          QuestionController::store() or update()                     │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Get validated data: $validated = $request->validated()           │
│                                                                       │
│ 2. ADDITIONAL EXAM CHECKS (before database write)                   │
│    $exam = Exam::findOrFail($validated['exam_id'])                  │
│    $errors = $exam->validateQuestionAddition($marks)                │
│    if ($errors) → Return 422 with $errors                           │
│                                                                       │
│ 3. PREPARE QUESTION DATA                                            │
│    Map validated fields to model                                    │
│    Store array data in JSON columns                                 │
│    Prepare options if choice-based                                  │
│                                                                       │
│ 4. DATABASE TRANSACTION                                             │
│    DB::beginTransaction()                                           │
│      ├─ Create Question record                                      │
│      ├─ Create QuestionOption records (if applicable)               │
│      └─ Commit transaction                                          │
│    DB::rollBack() on error                                          │
│                                                                       │
│ ✅ SUCCESS → Return 201/200 with Question data                      │
│ ❌ FAIL → Return 500 with error message                             │
└──────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RESPONSE TO CLIENT                                │
│                                                                       │
│  ✅ 201 Created / 200 OK                                             │
│     {                                                                │
│       "message": "Question created/updated successfully",           │
│       "question": { id, text, type, marks, options, ... }           │
│     }                                                                │
│                                                                       │
│  ❌ 422 Unprocessable Entity                                         │
│     {                                                                │
│       "message": "The given data was invalid.",                      │
│       "errors": {                                                    │
│         "field": ["Error message 1", "Error message 2"],            │
│         "another": ["Error message"]                                │
│       }                                                              │
│     }                                                                │
│                                                                       │
│  ❌ 500 Internal Server Error                                        │
│     {                                                                │
│       "message": "Failed to create/update question",                │
│       "error": "exception message"                                  │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Validation Layer Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         API REQUEST                                 │
└────────────────────────┬───────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌────────────┐    ┌──────────┐
   │ LARAVEL │    │  CUSTOM    │    │ BUSINESS │
   │ REQUEST │───▶│ VALIDATION │───▶│  LOGIC   │
   │ RULES   │    │   RULES    │    │ CHECKS   │
   └─────────┘    └────────────┘    └──────────┘
        │                │                │
        │ Basic Fields   │ Complex Rules  │ Status/Marks
        │ Types          │ MCQ Options    │ Exam Checks
        │ Required       │ Blank Matching │ Type Rules
        │ Lengths        │ Pair Equality  │
        │                │ Ordering Items │
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ❌ Error?
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
    ┌────────┐                      ┌──────────┐
    │ Return │                      │ Continue │
    │ 422    │                      │   to     │
    │ Error  │                      │Controller│
    └────────┘                      └─────────┬┘
                                              │
                                    ┌─────────▼────────┐
                                    │ MODEL VALIDATION │
                                    │ (Additional)     │
                                    └─────────┬────────┘
                                              │
                                    ┌─────────▼────────┐
                                    │  DB TRANSACTION  │
                                    │  Save to DB      │
                                    └─────────┬────────┘
                                              │
                                    ┌─────────▼────────┐
                                    │ Return 201/200   │
                                    │ Success Response │
                                    └──────────────────┘
```

---

## Validation Decision Tree

```
REQUEST RECEIVED
│
├─ Is exam_id provided and valid?
│  ├─ NO → Error: "exam does not exist"
│  └─ YES ↓
│
├─ Is exam closed?
│  ├─ YES → Error: "Cannot add/edit in closed exam"
│  └─ NO ↓
│
├─ Is question_text valid (10-5000 chars)?
│  ├─ NO → Error: "Question text invalid"
│  └─ YES ↓
│
├─ Are marks valid (0.5-100)?
│  ├─ NO → Error: "Marks out of range"
│  └─ YES ↓
│
├─ Do marks exceed exam total?
│  ├─ YES → Error: "Exceeds exam total ({X})"
│  └─ NO ↓
│
├─ What's the question type?
│  │
│  ├─ MULTIPLE_CHOICE_SINGLE
│  │  ├─ Has ≥2 options?
│  │  │  ├─ NO → Error: "Need ≥2 options"
│  │  │  └─ YES ↓
│  │  └─ Has exactly 1 correct?
│  │     ├─ NO → Error: "Need exactly 1 correct"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ MULTIPLE_CHOICE_MULTIPLE
│  │  ├─ Has ≥2 options?
│  │  │  ├─ NO → Error: "Need ≥2 options"
│  │  │  └─ YES ↓
│  │  └─ Has ≥1 correct?
│  │     ├─ NO → Error: "Need ≥1 correct"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ TRUE_FALSE
│  │  └─ Answer is 'true' or 'false'?
│  │     ├─ NO → Error: "Invalid answer"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ FILL_BLANK
│  │  ├─ Has _____ blanks?
│  │  │  ├─ NO → Error: "No blanks found"
│  │  │  └─ YES ↓
│  │  └─ Blank count = answer count?
│  │     ├─ NO → Error: "Counts don't match"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ MATCHING
│  │  ├─ Has ≥2 pairs?
│  │  │  ├─ NO → Error: "Need ≥2 pairs"
│  │  │  └─ YES ↓
│  │  ├─ All pairs complete?
│  │  │  ├─ NO → Error: "Incomplete pairs"
│  │  │  └─ YES ↓
│  │  └─ No duplicates?
│  │     ├─ NO → Error: "Duplicate pairs"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ ORDERING
│  │  ├─ Has ≥2 items?
│  │  │  ├─ NO → Error: "Need ≥2 items"
│  │  │  └─ YES ↓
│  │  └─ All unique & non-empty?
│  │     ├─ NO → Error: "Invalid items"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ IMAGE_BASED
│  │  └─ Has image_url?
│  │     ├─ NO → Error: "URL required"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ AUDIO_BASED
│  │  └─ Has audio_url?
│  │     ├─ NO → Error: "URL required"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ PASSAGE
│  │  └─ Has passage_text?
│  │     ├─ NO → Error: "Text required"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ CASE_STUDY
│  │  └─ Has case_study_text?
│  │     ├─ NO → Error: "Text required"
│  │     └─ YES → ✅ VALID
│  │
│  ├─ CALCULATION
│  │  └─ Has correct_answer?
│  │     ├─ NO → Error: "Answer required"
│  │     └─ YES → ✅ VALID
│  │
│  └─ PRACTICAL
│     └─ Has scenario_text?
│        ├─ NO → Error: "Text required"
│        └─ YES → ✅ VALID
│
└─ ✅ ALL VALIDATIONS PASSED
   │
   └─ SAVE TO DATABASE & RETURN 201/200 SUCCESS
```

---

## Error Response Examples

### Example 1: Closed Exam Error
```
STATUS: 422 Unprocessable Entity

{
  "message": "Cannot add question to this exam",
  "errors": {
    "exam_id": ["Cannot add questions to a closed exam"]
  }
}
```

### Example 2: Multiple Validation Errors
```
STATUS: 422 Unprocessable Entity

{
  "message": "The given data was invalid.",
  "errors": {
    "question_text": [
      "Question must be at least 10 characters"
    ],
    "marks": [
      "Marks cannot exceed exam total marks (50)"
    ],
    "options": [
      "Multiple choice questions must have at least 2 options"
    ]
  }
}
```

### Example 3: Type-Specific Error
```
STATUS: 422 Unprocessable Entity

{
  "message": "The given data was invalid.",
  "errors": {
    "blank_answers": [
      "Number of blanks (2) must match number of answers (1)"
    ]
  }
}
```

### Example 4: Success Response
```
STATUS: 201 Created

{
  "message": "Question created successfully",
  "question": {
    "id": 42,
    "exam_id": 1,
    "question_text": "What is the capital of France?",
    "question_type": "multiple_choice_single",
    "marks": 5,
    "options": [
      { "id": 1, "option_text": "London", "is_correct": false, "order_index": 0 },
      { "id": 2, "option_text": "Paris", "is_correct": true, "order_index": 1 },
      { "id": 3, "option_text": "Berlin", "is_correct": false, "order_index": 2 }
    ],
    "created_at": "2025-12-20T10:30:00Z"
  }
}
```

---

## Class Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                  HTTP Request                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
 ┌─────────────────┐          ┌──────────────────────┐
 │ Store Question  │          │ Update Question      │
 │ Request         │          │ Request              │
 └────────┬────────┘          └─────────┬────────────┘
          │                             │
          └─────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │ QuestionController          │
          │                             │
          │ store()  update()           │
          │ validate exam status        │
          │ save to database            │
          └────────────┬────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐   ┌────────┐   ┌────────────┐
    │ Exam   │   │Question│   │ Question   │
    │ Model  │   │ Model  │   │ Option     │
    │        │   │        │   │ Model      │
    │Methods │   │Methods │   │            │
    └────────┘   └────────┘   └────────────┘
```

---

## Validation Checklist Template

```
QUESTION VALIDATION CHECKLIST
═══════════════════════════════════════════════════════════════

Basic Information:
  [ ] Exam ID is valid (exists in database)
  [ ] Exam is not closed
  [ ] Question text is 10-5000 characters
  [ ] Marks are 0.5-100 range
  [ ] Marks don't exceed exam total

Question Type Specific:
  [ ] Question type is one of 14 valid types
  [ ] Type-specific required fields are provided
  [ ] Type-specific data is valid

Type Details (if applicable):
  
  Multiple Choice:
    [ ] At least 2 options
    [ ] All options have text
    [ ] Single answer: exactly 1 correct
    [ ] Multiple answer: at least 1 correct
  
  True/False:
    [ ] Answer is 'true' or 'false'
  
  Fill-in-the-Blank:
    [ ] Question contains _____ blanks
    [ ] Blank count matches answer count
    [ ] All answers are provided
  
  Matching:
    [ ] At least 2 pairs
    [ ] All pairs are complete
    [ ] No duplicate pairs
  
  Ordering:
    [ ] At least 2 items
    [ ] All items non-empty
    [ ] No duplicate items
  
  Media:
    [ ] image_url or audio_url is provided (if applicable)
    [ ] URL is valid format
  
  Text-Required Types:
    [ ] passage_text, case_study_text, scenario_text provided (if applicable)
    [ ] Text is at least 50 characters

Result: ✅ PASS or ❌ FAIL
```

---

## Performance Considerations

**Validation Performance**:
- Form request validation: ~1-2ms
- Business logic validation: ~2-5ms
- Database existence checks: ~5-10ms
- Total validation time: ~10-15ms

**Optimization Tips**:
- Validate locally before sending requests
- Batch similar validations
- Cache exam data if making multiple requests
- Use proper HTTP methods (POST for create, PUT for update)

---

## Production Deployment Notes

1. **Database Migration**: Ensure exam has `total_marks` column
2. **Error Logging**: All validation errors are logged
3. **API Documentation**: Share with frontend team
4. **Testing**: Run test suite before deployment
5. **Monitoring**: Track validation error rates
6. **Version Control**: Keep validation rules in sync across environments

---

*Architecture Documentation - Phase 4*
*Last Updated: December 20, 2025*
