# PHASE 5: ADMIN ACTIONS - API DOCUMENTATION

**Status**: ✅ **COMPLETE**

**Date**: December 20, 2025  
**Framework**: Laravel 10, PHP 8.2  
**API Version**: v1  

---

## Overview

Phase 5 implements comprehensive admin action endpoints for managing questions in exams. These endpoints provide:
- Question lifecycle management (create, read, update, delete)
- Question duplication and cloning
- Question status toggling (enable/disable)
- Question reordering within exams
- Question preview as student view
- Bulk operations
- Grouping and statistics

---

## Endpoints

### 1. Add Question to Exam

**Endpoint**: `POST /api/questions`

**Validation**: Uses `StoreQuestionRequest`

**Request Body**:
```json
{
  "exam_id": 1,
  "question_text": "What is the capital of France?",
  "question_type": "multiple_choice_single",
  "marks": 5,
  "options": [
    {"option_text": "London", "is_correct": false},
    {"option_text": "Paris", "is_correct": true},
    {"option_text": "Berlin", "is_correct": false}
  ]
}
```

**Response** (201 Created):
```json
{
  "message": "Question created successfully",
  "question": {
    "id": 42,
    "exam_id": 1,
    "question_text": "What is the capital of France?",
    "question_type": "multiple_choice_single",
    "marks": 5,
    "status": "active",
    "options": [...]
  }
}
```

**Error Response** (422 Unprocessable Entity):
```json
{
  "message": "Cannot add question to this exam",
  "errors": {
    "exam_id": ["Cannot add questions to a closed exam"]
  }
}
```

---

### 2. Edit Question

**Endpoint**: `PUT /api/questions/{id}`

**Validation**: Uses `UpdateQuestionRequest`

**Request Body** (all fields optional):
```json
{
  "question_text": "Updated question text?",
  "marks": 10,
  "options": [
    {"option_text": "Option A", "is_correct": true},
    {"option_text": "Option B", "is_correct": false}
  ]
}
```

**Response** (200 OK):
```json
{
  "message": "Question updated successfully",
  "question": {
    "id": 42,
    "question_text": "Updated question text?",
    "marks": 10,
    "options": [...]
  }
}
```

**Permissions**:
- ❌ Cannot edit if exam is closed
- ❌ Cannot increase marks beyond exam total
- ✅ Can change question type (carefully)
- ✅ Can update all fields

---

### 3. Duplicate Question

**Endpoint**: `POST /api/questions/{id}/duplicate`

**Description**: Creates a copy of the question with a new ID, including all options

**Request Body**: Empty or optional
```json
{
  "section": "optional_section_name"
}
```

**Response** (201 Created):
```json
{
  "message": "Question duplicated successfully",
  "question": {
    "id": 43,
    "exam_id": 1,
    "question_text": "What is the capital of France?",
    "status": "draft",
    "options": [...]
  },
  "original_id": 42,
  "new_id": 43
}
```

**Features**:
- ✅ Copies all question data
- ✅ Duplicates all options (if choice-based)
- ✅ Sets new question to "draft" status
- ❌ Cannot duplicate if exam is closed
- ✅ New ID is automatically assigned

---

### 4. Delete Question

**Endpoint**: `DELETE /api/questions/{id}`

**Response** (200 OK):
```json
{
  "message": "Question deleted successfully",
  "deleted_id": 42
}
```

**Permissions**:
- ❌ Cannot delete if exam is closed
- ✅ Deletes associated options automatically
- ✅ Returns deleted ID for UI confirmation

**Error Response** (422):
```json
{
  "message": "Cannot delete questions from a closed exam",
  "error": "Exam is closed"
}
```

---

### 5. Enable / Disable Question

**Endpoint**: `PATCH /api/questions/{id}/toggle-status`

**Description**: Toggles question status between "active" and "disabled"

**Request Body**: Empty
```json
{}
```

**Response** (200 OK):
```json
{
  "message": "Question enabled successfully",
  "question": {
    "id": 42,
    "status": "active"
  },
  "previous_status": "disabled",
  "new_status": "active"
}
```

**Status Transitions**:
- `active` → `disabled` (Hide from exam)
- `disabled` → `active` (Show in exam)
- `draft` → `active` (Publish question)

**Permissions**:
- ❌ Cannot change status if exam is closed
- ✅ Disabled questions are excluded from student view
- ✅ Can disable/enable anytime (except closed exams)

---

### 6. Reorder Questions

**Endpoint**: `POST /api/exams/{examId}/reorder-questions` (OR `POST /api/questions/reorder`)

**Description**: Reorders all questions within an exam

**Request Body**:
```json
{
  "questions": [
    {"id": 42, "order": 1},
    {"id": 43, "order": 2},
    {"id": 44, "order": 3},
    {"id": 45, "order": 4}
  ]
}
```

**Response** (200 OK):
```json
{
  "message": "Questions reordered successfully",
  "exam_id": 1,
  "questions": [
    {"id": 42, "order_index": 1, "question_text": "..."},
    {"id": 43, "order_index": 2, "question_text": "..."}
  ]
}
```

**Features**:
- ✅ Updates order_index for all questions
- ✅ Preserves question data
- ❌ Cannot reorder if exam is closed
- ✅ Returns reordered list for confirmation

---

### 7. Preview Question as Student

**Endpoint**: `GET /api/questions/{id}/preview`

**Description**: Returns question formatted as student would see it (hides correct answers, admin-only fields)

**Response** (200 OK):
```json
{
  "message": "Question preview",
  "preview": {
    "id": 42,
    "question_text": "What is the capital of France?",
    "question_type": "multiple_choice_single",
    "marks": 5,
    "time_limit": 30,
    "options": [
      {"id": 1, "option_text": "London", "order_index": 0},
      {"id": 2, "option_text": "Paris", "order_index": 1},
      {"id": 3, "option_text": "Berlin", "order_index": 2}
    ],
    "image_url": null,
    "audio_url": null
  },
  "exam": {
    "id": 1,
    "title": "Geography Quiz",
    "duration_minutes": 60
  }
}
```

**Features**:
- ✅ Hides `is_correct` field from options
- ✅ Hides marking rubric
- ✅ Optionally randomizes options (if exam setting enabled)
- ✅ Shows student-relevant fields only
- ✅ Includes exam context

**Hidden Fields** (Admin only):
- ❌ `is_correct` from options
- ❌ `marking_rubric`
- ❌ `order_index` (for admin)
- ❌ `status` (admin status)

---

### 8. Bulk Operations

#### Bulk Delete Questions

**Endpoint**: `POST /api/questions/bulk-delete`

**Request Body**:
```json
{
  "question_ids": [42, 43, 44, 45]
}
```

**Response** (200 OK):
```json
{
  "message": "Questions deleted successfully",
  "deleted_count": 4,
  "question_ids": [42, 43, 44, 45]
}
```

**Permissions**:
- ❌ Cannot delete from closed exams
- ✅ All-or-nothing transaction (all delete or none)
- ✅ Returns count of deleted questions

---

#### Bulk Update Question Status

**Endpoint**: `POST /api/questions/bulk-status`

**Request Body**:
```json
{
  "question_ids": [42, 43, 44],
  "status": "disabled"
}
```

**Response** (200 OK):
```json
{
  "message": "Questions updated to disabled successfully",
  "updated_count": 3,
  "question_ids": [42, 43, 44],
  "new_status": "disabled"
}
```

**Allowed Statuses**:
- `active` - Show in exam
- `disabled` - Hide from exam
- `draft` - Work in progress

---

### 9. Group Questions

**Endpoint**: `POST /api/questions/group/by/{examId}`

**Parameters**:
- `group_by` (required): `question_type`, `passage`, or `section`

**Request Body**:
```json
{
  "group_by": "question_type"
}
```

**Response** (200 OK):
```json
{
  "message": "Questions grouped by question_type",
  "exam_id": 1,
  "group_by": "question_type",
  "groups": {
    "multiple_choice_single": {
      "count": 5,
      "total_marks": 25,
      "questions": [...]
    },
    "essay": {
      "count": 2,
      "total_marks": 20,
      "questions": [...]
    }
  },
  "total_questions": 7,
  "total_marks": 45
}
```

**Grouping Options**:

**1. By Question Type**
```
- multiple_choice_single
- multiple_choice_multiple
- true_false
- short_answer
- essay
- fill_blank
- matching
- ordering
- image_based
- audio_based
- passage
- case_study
- calculation
- practical
```

**2. By Passage** (for comprehension questions)
```
- Passage 1 text (truncated 50 chars)...
  └─ Sub-questions related to passage
```

**3. By Section** (for grouped sections)
```
- Section A
- Section B
- Ungrouped
```

---

### 10. Get Exam Statistics

**Endpoint**: `GET /api/questions/statistics/exam/{examId}`

**Response** (200 OK):
```json
{
  "message": "Exam statistics",
  "exam_id": 1,
  "exam_title": "Geography Quiz",
  "statistics": {
    "total_questions": 10,
    "total_marks": 50,
    "by_type": {
      "multiple_choice_single": {
        "count": 5,
        "marks": 25,
        "percentage": 50
      },
      "essay": {
        "count": 2,
        "marks": 20,
        "percentage": 20
      }
    },
    "by_difficulty": {
      "easy": {
        "count": 4,
        "marks": 16,
        "percentage": 40
      },
      "medium": {
        "count": 4,
        "marks": 20,
        "percentage": 40
      },
      "hard": {
        "count": 2,
        "marks": 14,
        "percentage": 20
      }
    },
    "by_status": {
      "active": {
        "count": 9,
        "marks": 45
      },
      "disabled": {
        "count": 1,
        "marks": 5
      }
    }
  }
}
```

**Statistics Provided**:
- ✅ Total questions and marks
- ✅ Breakdown by question type
- ✅ Breakdown by difficulty level
- ✅ Breakdown by status (active/disabled/draft)
- ✅ Percentages for better visualization

---

## Bulk Upload (CSV/Excel)

### File Format

**CSV Header**:
```
question_text,question_type,marks,max_words,marking_rubric,option_1,option_2,option_3,option_4,correct_option
```

**Example CSV**:
```
What is the capital of France?,multiple_choice_single,5,0,,Paris,London,Berlin,Rome,1
Explain photosynthesis,essay,10,200,Clarity of explanation,,,,,
The Eiffel Tower is in _____.,fill_blank,3,0,,Paris,,,
```

### Supported Types in CSV

| Type | Column Setup | Example |
|------|-------------|---------|
| MCQ Single | `option_1...option_4, correct_option` | "1" = first option |
| MCQ Multiple | `option_1...option_4, correct_option` | "1,2" = first two |
| Essay | `max_words, marking_rubric` | "200" |
| Short Answer | `max_words` | "100" |
| Fill Blank | `question_text` with blanks | Use `_____` marker |
| T/F | `question_text, correct_answer` | "true" or "false" |

---

## Error Handling

### Common Error Responses

**422 Unprocessable Entity** (Validation Error):
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": ["Error message"]
  }
}
```

**422 Unprocessable Entity** (Business Logic Error):
```json
{
  "message": "Cannot add question to this exam",
  "errors": [
    "Cannot add questions to a closed exam"
  ]
}
```

**404 Not Found**:
```json
{
  "message": "Question not found",
  "error": "Resource not found"
}
```

**500 Internal Server Error**:
```json
{
  "message": "Failed to create question",
  "error": "Exception message"
}
```

---

## Status Codes Reference

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH, DELETE |
| 201 | Created | Successful POST (create/duplicate) |
| 400 | Bad Request | Malformed request |
| 401 | Unauthorized | Missing auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Server Error | Unexpected error |

---

## Permission Model

### Who Can Perform Actions?

| Action | Requirement | Exam Status |
|--------|-------------|------------|
| Add Question | Admin | Not closed |
| Edit Question | Admin | Not closed |
| Delete Question | Admin | Not closed |
| Duplicate Question | Admin | Not closed |
| Toggle Status | Admin | Not closed |
| Reorder Questions | Admin | Not closed |
| Preview Question | Admin/Student | Any |
| View Statistics | Admin | Any |
| Group Questions | Admin | Any |

---

## Transaction Safety

All operations use database transactions:

```
✅ All-or-nothing semantics
✅ Automatic rollback on error
✅ Data consistency guaranteed
✅ No partial updates
```

---

## Response Format Consistency

All responses follow this pattern:

**Success**:
```json
{
  "message": "Operation completed successfully",
  "data": { ... }
}
```

**Error**:
```json
{
  "message": "Error description",
  "error": "Technical details",
  "errors": { "field": ["message"] }
}
```

---

## Usage Examples

### Example 1: Create and Duplicate Question

```bash
# Create question
POST /api/questions
{
  "exam_id": 1,
  "question_text": "Original question?",
  "question_type": "multiple_choice_single",
  "marks": 5,
  "options": [
    {"option_text": "A", "is_correct": true},
    {"option_text": "B", "is_correct": false}
  ]
}
# Returns: id = 42

# Duplicate it
POST /api/questions/42/duplicate
# Returns: id = 43 (copy of 42)
```

### Example 2: Reorder Questions

```bash
POST /api/exams/1/reorder-questions
{
  "questions": [
    {"id": 43, "order": 1},
    {"id": 42, "order": 2},
    {"id": 44, "order": 3}
  ]
}
```

### Example 3: Preview and Statistics

```bash
# Preview question as student
GET /api/questions/42/preview

# Get exam statistics
GET /api/questions/statistics/exam/1

# Group questions by type
POST /api/questions/group/by/1
{
  "group_by": "question_type"
}
```

---

## Database Transactions

All operations use transactions:
```php
DB::beginTransaction();
try {
    // Operation
    DB::commit();
} catch (Exception $e) {
    DB::rollBack();
    // Return error
}
```

---

## Performance Considerations

- ✅ Indexes on frequently queried fields
- ✅ Eager loading of relationships (with options)
- ✅ Pagination support where applicable
- ✅ Efficient bulk operations
- ⚠️ Large CSV imports may need optimization

---

## Future Enhancements

Potential Phase 5+ improvements:
- Question versioning/history
- Question banking/library
- Advanced filtering
- Scheduled publication
- Question analytics
- A/B testing variants

---

*Phase 5 API Documentation - Complete*  
*December 20, 2025*
