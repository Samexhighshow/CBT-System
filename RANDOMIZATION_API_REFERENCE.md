# Question Randomization API - Quick Reference

**Base URL**: `http://localhost:8000/api`

**Authentication**: All endpoints require `Authorization: Bearer <token>` header

---

## 1. Get Exam Statistics & Settings

```
GET /exams/{id}/randomization/stats
```

**Description**: Load current randomization configuration and available question statistics

**Parameters**:
- `id` (URL) - Exam ID

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "exam": {
    "id": 1,
    "title": "Mathematics Final Exam",
    "question_selection_mode": "random",
    "total_questions_to_serve": 30,
    "shuffle_question_order": true,
    "shuffle_option_order": true,
    "question_distribution": "unique_per_student",
    "difficulty_distribution": {
      "easy": 10,
      "medium": 15,
      "hard": 5
    },
    "marks_distribution": null,
    "topic_filters": null,
    "question_reuse_policy": "allow_reuse",
    "questions_locked": false,
    "questions_locked_at": null
  },
  "stats": {
    "total_questions": 200,
    "active_questions": 195,
    "selections_generated": 0,
    "available_breakdown": {
      "by_difficulty": {
        "easy": 60,
        "medium": 85,
        "hard": 50
      },
      "by_marks": {
        "2": 50,
        "5": 100,
        "10": 45
      }
    }
  }
}
```

**Error Response** (404):
```json
{
  "message": "Exam not found"
}
```

---

## 2. Generate Preview (Validate without saving)

```
GET /exams/{id}/randomization/preview
```

**Description**: Simulate question selection to validate configuration before saving

**Parameters**:
- `id` (URL) - Exam ID

**Response** (200 OK - Valid):
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": [],
  "distribution": {
    "total_questions": 30,
    "total_marks": 85,
    "by_difficulty": {
      "easy": 10,
      "medium": 15,
      "hard": 5
    },
    "by_marks": {
      "2": 10,
      "5": 15,
      "10": 5
    }
  },
  "sample_questions": [
    {
      "id": 1,
      "question_text": "What is 2+2?",
      "marks": 2,
      "difficulty_level": "easy"
    },
    {
      "id": 5,
      "question_text": "Solve: x² - 5x + 6 = 0",
      "marks": 5,
      "difficulty_level": "medium"
    }
  ],
  "message": "Selection is valid and ready to lock"
}
```

**Response** (422 - Invalid):
```json
{
  "is_valid": false,
  "errors": [
    "Requested 10 easy questions but only 5 available",
    "Distribution total (20) does not match requested questions (30)"
  ],
  "warnings": [],
  "message": "Configuration is invalid. Please fix errors before locking."
}
```

---

## 3. Save Randomization Settings

```
PUT /exams/{id}/randomization
```

**Description**: Save randomization configuration to database

**Parameters**:
- `id` (URL) - Exam ID

**Request Body**:
```json
{
  "question_selection_mode": "random",
  "total_questions_to_serve": 30,
  "shuffle_question_order": true,
  "shuffle_option_order": true,
  "question_distribution": "unique_per_student",
  "difficulty_distribution": {
    "easy": 10,
    "medium": 15,
    "hard": 5
  },
  "marks_distribution": null,
  "topic_filters": null,
  "question_reuse_policy": "allow_reuse"
}
```

**Response** (200 OK):
```json
{
  "exam": {
    "id": 1,
    "title": "Mathematics Final Exam",
    "question_selection_mode": "random",
    "total_questions_to_serve": 30,
    "shuffle_question_order": true,
    "shuffle_option_order": true,
    "question_distribution": "unique_per_student",
    "difficulty_distribution": {
      "easy": 10,
      "medium": 15,
      "hard": 5
    },
    "marks_distribution": null,
    "topic_filters": null,
    "question_reuse_policy": "allow_reuse",
    "questions_locked": false,
    "questions_locked_at": null,
    "updated_at": "2025-12-22T10:30:00Z"
  },
  "message": "Randomization settings updated successfully"
}
```

**Error Response** (422 - Validation Failed):
```json
{
  "message": "Validation failed",
  "errors": {
    "total_questions_to_serve": ["Total questions must be positive integer"],
    "difficulty_distribution": ["Distribution total must equal total questions"]
  }
}
```

**Error Response** (400 - Locked):
```json
{
  "message": "Cannot modify randomization settings for a locked exam. Unlock it first.",
  "error_code": "exam_locked"
}
```

---

## 4. Lock Questions (Freeze Settings)

```
POST /exams/{id}/randomization/lock
```

**Description**: Prevent further modifications to randomization settings

**Parameters**:
- `id` (URL) - Exam ID

**Request Body**: Empty `{}`

**Response** (200 OK):
```json
{
  "exam": {
    "id": 1,
    "title": "Mathematics Final Exam",
    "questions_locked": true,
    "questions_locked_at": "2025-12-22T10:35:45Z"
  },
  "message": "Questions locked successfully",
  "locked_at": "2025-12-22T10:35:45Z"
}
```

**Error Response** (400 - Already Locked):
```json
{
  "message": "Questions are already locked for this exam",
  "error_code": "already_locked"
}
```

---

## 5. Unlock Questions (Allow Modifications)

```
POST /exams/{id}/randomization/unlock
```

**Description**: Allow modifications to settings (existing selections are deleted)

**Parameters**:
- `id` (URL) - Exam ID

**Request Body**: Empty `{}`

**Response** (200 OK):
```json
{
  "exam": {
    "id": 1,
    "title": "Mathematics Final Exam",
    "questions_locked": false,
    "questions_locked_at": null
  },
  "message": "Questions unlocked. Existing selections have been reset.",
  "selections_deleted": 15
}
```

---

## 6. Get or Generate Student Selection

```
GET /exams/{id}/randomization/selection
```

**Description**: Get randomized question selection for a student (generates if not exists)

**Parameters**:
- `id` (URL) - Exam ID
- `student_id` (query, optional) - Specific student ID
- `user_id` (query, optional) - Current authenticated user ID (default if not provided)

**Example Requests**:
```
GET /exams/1/randomization/selection
GET /exams/1/randomization/selection?user_id=5
GET /exams/1/randomization/selection?student_id=3
```

**Response** (200 OK):
```json
{
  "selection": {
    "id": 42,
    "exam_id": 1,
    "student_id": 5,
    "user_id": 5,
    "question_ids": [
      1,
      7,
      15,
      3,
      21,
      9,
      27,
      5,
      31,
      13,
      2,
      18,
      10,
      8,
      20,
      4,
      16,
      6,
      14,
      12,
      22,
      24,
      26,
      28,
      30,
      32,
      44,
      36,
      50,
      38
    ],
    "option_shuffles": {
      "1": [3, 1, 4, 2],
      "7": [2, 4, 1, 3],
      "15": [1, 3, 2, 4],
      "3": [4, 2, 3, 1],
      "21": [2, 1, 4, 3]
    },
    "total_questions": 30,
    "total_marks": 85,
    "distribution_summary": {
      "by_difficulty": {
        "easy": 10,
        "medium": 15,
        "hard": 5
      },
      "by_marks": {
        "2": 10,
        "5": 15,
        "10": 5
      }
    },
    "is_locked": false,
    "locked_at": null,
    "created_at": "2025-12-22T10:40:15Z",
    "updated_at": "2025-12-22T10:40:15Z"
  },
  "questions": [
    {
      "id": 1,
      "exam_id": 1,
      "question_text": "What is 2+2?",
      "question_type": "mcq",
      "marks": 2,
      "difficulty_level": "easy",
      "options": [
        {
          "id": 1,
          "option_text": "3",
          "position": 0
        },
        {
          "id": 2,
          "option_text": "4",
          "position": 1
        },
        {
          "id": 3,
          "option_text": "5",
          "position": 2
        },
        {
          "id": 4,
          "option_text": "6",
          "position": 3
        }
      ],
      "shuffled_option_ids": [3, 1, 4, 2]
    },
    {
      "id": 7,
      "exam_id": 1,
      "question_text": "Solve: 2x - 5 = 3",
      "question_type": "mcq",
      "marks": 3,
      "difficulty_level": "medium",
      "options": [
        {
          "id": 21,
          "option_text": "2",
          "position": 0
        },
        {
          "id": 22,
          "option_text": "4",
          "position": 1
        },
        {
          "id": 23,
          "option_text": "6",
          "position": 2
        }
      ],
      "shuffled_option_ids": [2, 4, 1, 3]
    }
  ],
  "exam": {
    "id": 1,
    "title": "Mathematics Final Exam",
    "duration_minutes": 120,
    "total_questions": 200
  }
}
```

**Error Response** (404):
```json
{
  "message": "Exam or selection not found"
}
```

---

## Request/Response Examples for Frontend

### JavaScript/Axios Example

```javascript
// Using Axios with API service
import { api } from './services/api';

// 1. Get Statistics
async function loadStats(examId) {
  try {
    const response = await api.get(`/exams/${examId}/randomization/stats`);
    console.log('Current settings:', response.data.exam);
    console.log('Available questions:', response.data.stats.available_breakdown);
  } catch (error) {
    console.error('Failed to load stats:', error.response.data);
  }
}

// 2. Save Settings
async function saveSettings(examId, settings) {
  try {
    const response = await api.put(`/exams/${examId}/randomization`, settings);
    console.log('Settings saved:', response.data.exam);
    return response.data.exam;
  } catch (error) {
    if (error.response.status === 400 && error.response.data.error_code === 'exam_locked') {
      console.error('Exam is locked. Unlock it first.');
    } else {
      console.error('Validation errors:', error.response.data.errors);
    }
  }
}

// 3. Generate Preview
async function previewSettings(examId) {
  try {
    const response = await api.get(`/exams/${examId}/randomization/preview`);
    if (response.data.is_valid) {
      console.log('✓ Configuration is valid');
      console.log('Distribution:', response.data.distribution);
    } else {
      console.error('✗ Errors:', response.data.errors);
    }
    return response.data;
  } catch (error) {
    console.error('Preview generation failed:', error.message);
  }
}

// 4. Lock Questions
async function lockQuestions(examId) {
  try {
    const response = await api.post(`/exams/${examId}/randomization/lock`);
    console.log('Questions locked at:', response.data.locked_at);
  } catch (error) {
    console.error('Lock failed:', error.response.data.message);
  }
}

// 5. Get Student Selection
async function getStudentQuestions(examId) {
  try {
    const response = await api.get(`/exams/${examId}/randomization/selection`);
    console.log('Student selection:', response.data.selection);
    console.log('Questions to display:', response.data.questions);
    return response.data;
  } catch (error) {
    console.error('Failed to get selection:', error.message);
  }
}
```

---

## Common Use Cases

### Use Case 1: Admin Configures Randomization

```javascript
// Step 1: Load stats to see available questions
const stats = await api.get(`/exams/1/randomization/stats`);

// Step 2: Configure settings in UI
const settings = {
  question_selection_mode: 'random',
  total_questions_to_serve: 30,
  shuffle_question_order: true,
  shuffle_option_order: true,
  question_distribution: 'unique_per_student',
  difficulty_distribution: { easy: 10, medium: 15, hard: 5 },
  marks_distribution: null,
  topic_filters: null,
  question_reuse_policy: 'allow_reuse'
};

// Step 3: Preview before saving
const preview = await api.get(`/exams/1/randomization/preview`);
if (preview.data.is_valid) {
  // Step 4: Save settings
  await api.put(`/exams/1/randomization`, settings);
  
  // Step 5: Lock questions
  await api.post(`/exams/1/randomization/lock`);
}
```

### Use Case 2: Student Takes Exam

```javascript
// When student clicks "Start Exam"
const response = await api.get(`/exams/1/randomization/selection`);

// Display only the questions in response.data.questions
// Apply shuffled option order from response.data.selection.option_shuffles
// Store selection.id for answer submission

const { selection, questions } = response.data;

questions.forEach(question => {
  const shuffleMap = selection.option_shuffles[question.id];
  if (shuffleMap) {
    // Reorder options according to shuffle
    const originalOptions = question.options;
    question.options = shuffleMap.map(idx => originalOptions[idx - 1]);
  }
});

// Now display questions in order of selection.question_ids
```

---

## Status Codes Reference

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Exam locked, invalid parameters |
| 404 | Not Found | Exam/selection doesn't exist |
| 422 | Unprocessable Entity | Validation failed (distribution mismatch) |
| 500 | Server Error | Internal server error, check logs |

---

## Error Handling Patterns

### Pattern 1: Validation Errors
```javascript
try {
  await api.put(`/exams/${id}/randomization`, settings);
} catch (error) {
  if (error.response.status === 422) {
    // Show validation errors to user
    Object.entries(error.response.data.errors).forEach(([field, messages]) => {
      console.error(`${field}: ${messages.join(', ')}`);
    });
  }
}
```

### Pattern 2: Locked Exam
```javascript
try {
  await api.put(`/exams/${id}/randomization`, settings);
} catch (error) {
  if (error.response.data.error_code === 'exam_locked') {
    // Prompt user to unlock first
    const unlock = confirm('Exam is locked. Unlock to make changes?');
    if (unlock) {
      await api.post(`/exams/${id}/randomization/unlock`);
      // Retry save
    }
  }
}
```

---

## Rate Limiting & Performance Notes

- No specific rate limiting on randomization endpoints
- Preview generation is lightweight (no database changes)
- Selection generation is fast (<100ms) due to indexed queries
- Option shuffling scales with question count
- Recommended: Cache stats for 5 minutes

---

## Troubleshooting

**Q: Getting 404 on randomization endpoints?**  
A: Check that migrations have run: `php artisan migrate`

**Q: Getting validation error about distribution total?**  
A: Sum of distribution values must equal total_questions_to_serve

**Q: Selection not changing after unlock?**  
A: Unlock deletes old selections; next call regenerates them

**Q: Options showing in wrong order to student?**  
A: Verify shuffled_option_ids are being applied; check option positions
