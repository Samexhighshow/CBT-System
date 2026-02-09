# Phase 7 API Reference

Complete API documentation for Phase 7 question organization features.

## Base URL

```
http://localhost:8000/api
```

---

## Question Tags API

### Get All Tags

```http
GET /question-tags
```

**Query Parameters:**
- `search` (optional): Search in tag name
- `category` (optional): Filter by category

**Response:**
```json
{
  "tags": [
    {
      "id": 1,
      "name": "Calculus",
      "category": "topic",
      "color": "#3b82f6",
      "description": "Questions about calculus",
      "question_count": 15,
      "created_at": "2025-12-20T10:00:00.000000Z",
      "updated_at": "2025-12-20T10:00:00.000000Z"
    }
  ]
}
```

---

### Get Popular Tags

```http
GET /question-tags/popular
```

**Query Parameters:**
- `limit` (optional, default: 10): Number of tags to return

**Response:**
```json
{
  "tags": [
    {
      "id": 1,
      "name": "Calculus",
      "question_count": 25,
      "color": "#3b82f6"
    }
  ]
}
```

---

### Get Tags by Category

```http
GET /question-tags/category/{category}
```

**Path Parameters:**
- `category` (required): One of: `topic`, `difficulty`, `format`, `skill`, `other`

**Response:**
```json
{
  "category": "topic",
  "tags": [
    {
      "id": 1,
      "name": "Calculus",
      "color": "#3b82f6",
      "question_count": 15
    }
  ]
}
```

---

### Create Tag

```http
POST /question-tags
```

**Request Body:**
```json
{
  "name": "Calculus",
  "category": "topic",
  "color": "#3b82f6",
  "description": "Questions about calculus (optional)"
}
```

**Validation Rules:**
- `name`: Required, string, max 100 characters, unique
- `category`: Required, one of: `topic`, `difficulty`, `format`, `skill`, `other`
- `color`: Required, hex color code (e.g., #3b82f6)
- `description`: Optional, string

**Response (201 Created):**
```json
{
  "message": "Tag created successfully",
  "tag": {
    "id": 1,
    "name": "Calculus",
    "category": "topic",
    "color": "#3b82f6",
    "description": "Questions about calculus",
    "question_count": 0,
    "created_at": "2025-12-20T10:00:00.000000Z",
    "updated_at": "2025-12-20T10:00:00.000000Z"
  }
}
```

---

### Update Tag

```http
PUT /question-tags/{id}
```

**Path Parameters:**
- `id` (required): Tag ID

**Request Body:**
```json
{
  "name": "Advanced Calculus",
  "category": "topic",
  "color": "#8b5cf6",
  "description": "Advanced calculus topics"
}
```

**Response (200 OK):**
```json
{
  "message": "Tag updated successfully",
  "tag": {
    "id": 1,
    "name": "Advanced Calculus",
    "category": "topic",
    "color": "#8b5cf6"
  }
}
```

---

### Delete Tag

```http
DELETE /question-tags/{id}
```

**Path Parameters:**
- `id` (required): Tag ID

**Response (200 OK):**
```json
{
  "message": "Tag deleted successfully"
}
```

**Note:** Deleting a tag will remove all associations with questions (cascade delete).

---

### Get Questions with Tag

```http
GET /question-tags/{id}/questions
```

**Path Parameters:**
- `id` (required): Tag ID

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional, default: 15): Items per page

**Response:**
```json
{
  "tag": {
    "id": 1,
    "name": "Calculus"
  },
  "questions": {
    "data": [
      {
        "id": 1,
        "question_text": "What is the derivative of x²?",
        "marks": 5,
        "exam": {
          "id": 5,
          "title": "Mathematics Final"
        }
      }
    ],
    "current_page": 1,
    "total": 25
  }
}
```

---

### Attach Tags to Question

```http
POST /question-tags/questions/{questionId}/attach
```

**Path Parameters:**
- `questionId` (required): Question ID

**Request Body:**
```json
{
  "tag_ids": [1, 2, 3]
}
```

**Validation Rules:**
- `tag_ids`: Required, array of existing tag IDs

**Response (200 OK):**
```json
{
  "message": "Tags attached successfully",
  "question": {
    "id": 123,
    "tags": [
      {
        "id": 1,
        "name": "Calculus",
        "color": "#3b82f6"
      }
    ]
  }
}
```

---

### Detach Tag from Question

```http
DELETE /question-tags/questions/{questionId}/tags/{tagId}
```

**Path Parameters:**
- `questionId` (required): Question ID
- `tagId` (required): Tag ID to detach

**Response (200 OK):**
```json
{
  "message": "Tag detached successfully"
}
```

---

## Question Pools API

### Get Pools for Exam

```http
GET /exams/{examId}/pools
```

**Path Parameters:**
- `examId` (required): Exam ID

**Query Parameters:**
- `include_inactive` (optional, default: false): Include inactive pools

**Response:**
```json
{
  "pools": [
    {
      "id": 1,
      "exam_id": 5,
      "name": "Easy Questions Pool",
      "description": "Pool of easier questions",
      "question_count": 20,
      "total_marks": 100,
      "draw_count": 10,
      "is_active": true,
      "created_at": "2025-12-20T10:00:00.000000Z",
      "updated_at": "2025-12-20T10:00:00.000000Z"
    }
  ]
}
```

---

### Get Active Pools

```http
GET /exams/{examId}/pools/active
```

**Path Parameters:**
- `examId` (required): Exam ID

**Response:**
```json
{
  "pools": [
    {
      "id": 1,
      "name": "Easy Questions Pool",
      "question_count": 20,
      "draw_count": 10
    }
  ]
}
```

---

### Create Pool

```http
POST /exams/{examId}/pools
```

**Path Parameters:**
- `examId` (required): Exam ID

**Request Body:**
```json
{
  "name": "Easy Questions Pool",
  "description": "Pool of easier questions for warm-up",
  "draw_count": 10,
  "is_active": true
}
```

**Validation Rules:**
- `name`: Required, string, max 100 characters
- `description`: Optional, string
- `draw_count`: Required, integer, min 1
- `is_active`: Optional, boolean, default true

**Response (201 Created):**
```json
{
  "message": "Pool created successfully",
  "pool": {
    "id": 1,
    "exam_id": 5,
    "name": "Easy Questions Pool",
    "description": "Pool of easier questions for warm-up",
    "question_count": 0,
    "total_marks": 0,
    "draw_count": 10,
    "is_active": true,
    "created_at": "2025-12-20T10:00:00.000000Z",
    "updated_at": "2025-12-20T10:00:00.000000Z"
  }
}
```

---

### Update Pool

```http
PUT /exams/{examId}/pools/{poolId}
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Request Body:**
```json
{
  "name": "Updated Pool Name",
  "description": "Updated description",
  "draw_count": 15,
  "is_active": false
}
```

**Response (200 OK):**
```json
{
  "message": "Pool updated successfully",
  "pool": {
    "id": 1,
    "name": "Updated Pool Name",
    "draw_count": 15,
    "is_active": false
  }
}
```

---

### Delete Pool

```http
DELETE /exams/{examId}/pools/{poolId}
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Response (200 OK):**
```json
{
  "message": "Pool deleted successfully. Questions have been unassigned from this pool."
}
```

**Note:** Deleting a pool will set `pool_name` to NULL for all questions in that pool.

---

### Get Pool Statistics

```http
GET /exams/{examId}/pools/{poolId}/stats
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Response:**
```json
{
  "pool": {
    "id": 1,
    "name": "Easy Questions Pool",
    "question_count": 20,
    "total_marks": 100,
    "average_marks": 5.0,
    "draw_count": 10,
    "is_active": true
  },
  "statistics": {
    "difficulty_distribution": {
      "easy": 12,
      "medium": 6,
      "hard": 2
    },
    "type_distribution": {
      "multiple_choice_single": 10,
      "short_answer": 6,
      "essay": 4
    },
    "cognitive_level_distribution": {
      "remember": 5,
      "understand": 7,
      "apply": 8
    }
  }
}
```

---

### Draw Random Questions

```http
POST /exams/{examId}/pools/{poolId}/draw
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Request Body:**
```json
{
  "count": 5
}
```

**Validation Rules:**
- `count`: Optional, integer, min 1, default uses pool's draw_count

**Response (200 OK):**
```json
{
  "message": "Drew 5 questions from pool",
  "pool": {
    "id": 1,
    "name": "Easy Questions Pool"
  },
  "questions": [
    {
      "id": 10,
      "question_text": "What is 2+2?",
      "marks": 5,
      "difficulty_level": "easy"
    }
  ],
  "total_marks": 25
}
```

**Error (400 Bad Request):**
```json
{
  "message": "Cannot draw 10 questions. Pool only has 5 questions."
}
```

---

### Assign Questions to Pool

```http
POST /exams/{examId}/pools/{poolId}/assign
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Request Body:**
```json
{
  "question_ids": [1, 2, 3, 4, 5]
}
```

**Validation Rules:**
- `question_ids`: Required, array of integers

**Response (200 OK):**
```json
{
  "message": "5 questions assigned to pool",
  "pool": {
    "id": 1,
    "name": "Easy Questions Pool",
    "question_count": 25,
    "total_marks": 125
  }
}
```

**Error (422 Unprocessable Entity):**
```json
{
  "message": "Some questions do not belong to this exam",
  "invalid_questions": [1, 3]
}
```

---

### Remove Questions from Pool

```http
POST /exams/{examId}/pools/{poolId}/remove
```

**Path Parameters:**
- `examId` (required): Exam ID
- `poolId` (required): Pool ID

**Request Body:**
```json
{
  "question_ids": [1, 2, 3]
}
```

**Response (200 OK):**
```json
{
  "message": "3 questions removed from pool",
  "pool": {
    "id": 1,
    "question_count": 17,
    "total_marks": 85
  }
}
```

---

## Enhanced Question API

### Get Questions with Filters

```http
GET /questions
```

**Query Parameters:**

**Existing Filters:**
- `exam_id`: Filter by exam
- `question_type`: Filter by type
- `status`: Filter by status (active/inactive)
- `difficulty_level`: Filter by difficulty (easy/medium/hard)
- `search`: Full-text search in question text

**Phase 7 Filters:**
- `tags`: Comma-separated tag IDs (e.g., `1,3,5`)
- `pool_name`: Filter by pool name
- `cognitive_level`: Filter by cognitive level
- `topics`: Comma-separated topics
- `include_archived`: Include archived questions (default: false)
- `templates_only`: Show only templates (default: false)

**Example:**
```http
GET /questions?exam_id=5&tags=1,3,5&cognitive_level=apply&pool_name=Pool+A
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "question_text": "What is the derivative of x²?",
      "question_type": "short_answer",
      "marks": 5,
      "difficulty_level": "medium",
      "cognitive_level": "apply",
      "pool_name": "Pool A",
      "topics": ["derivatives", "polynomials"],
      "estimated_time": 5,
      "is_template": false,
      "is_archived": false,
      "tags": [
        {
          "id": 1,
          "name": "Calculus",
          "color": "#3b82f6"
        }
      ],
      "exam": {
        "id": 5,
        "title": "Mathematics Final"
      }
    }
  ],
  "current_page": 1,
  "total": 50
}
```

---

### Create Question with Phase 7 Fields

```http
POST /questions
```

**Request Body (Phase 7 Fields):**
```json
{
  "exam_id": 5,
  "question_text": "What is the derivative of x²?",
  "question_type": "short_answer",
  "marks": 5,
  "difficulty_level": "medium",
  "correct_answer": "2x",
  
  "pool_name": "Calculus Pool",
  "topics": ["derivatives", "polynomials"],
  "cognitive_level": "apply",
  "estimated_time": 5,
  "author_notes": "Common calculus question for beginners",
  "is_template": false,
  "tag_ids": [1, 3, 5]
}
```

**Phase 7 Validation Rules:**
- `pool_name`: Optional, string, max 50 characters
- `topics`: Optional, array of strings
- `cognitive_level`: Optional, one of: `remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`
- `estimated_time`: Optional, integer (minutes), min 1, max 180
- `author_notes`: Optional, string
- `is_template`: Optional, boolean, default false
- `tag_ids`: Optional, array of existing tag IDs

**Response (201 Created):**
```json
{
  "message": "Question created successfully",
  "question": {
    "id": 1,
    "question_text": "What is the derivative of x²?",
    "cognitive_level": "apply",
    "pool_name": "Calculus Pool",
    "topics": ["derivatives", "polynomials"],
    "tags": [
      {
        "id": 1,
        "name": "Calculus"
      }
    ]
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Invalid request",
  "errors": {
    "field_name": ["Error message"]
  }
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthenticated"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found"
}
```

### 422 Unprocessable Entity
```json
{
  "message": "Validation failed",
  "errors": {
    "name": ["The name field is required."],
    "color": ["The color must be a valid hex color code."]
  }
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## Rate Limiting

API endpoints are rate limited:
- **Standard endpoints**: 60 requests per minute
- **Create/Update/Delete**: 30 requests per minute
- **Bulk operations**: 10 requests per minute

**Rate limit headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1703001600
```

---

## Authentication

Include authentication token in headers:

```http
Authorization: Bearer {your_access_token}
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 15, max: 100)

**Response Format:**
```json
{
  "data": [...],
  "current_page": 1,
  "per_page": 15,
  "total": 150,
  "last_page": 10,
  "from": 1,
  "to": 15
}
```

---

## Sorting

Most list endpoints support sorting:

**Query Parameters:**
- `sort_by`: Field name (e.g., `created_at`, `name`, `question_count`)
- `sort_order`: `asc` or `desc` (default: `desc`)

**Example:**
```http
GET /question-tags?sort_by=question_count&sort_order=desc
```

---

## Batch Operations

### Bulk Tag Attachment
```http
POST /questions/bulk/attach-tags
{
  "question_ids": [1, 2, 3, 4, 5],
  "tag_ids": [1, 2]
}
```

### Bulk Pool Assignment
```http
POST /exams/{examId}/pools/{poolId}/bulk-assign
{
  "question_ids": [1, 2, 3, 4, 5]
}
```

---

## Webhooks (Future Feature)

Webhook events for Phase 7:
- `tag.created`
- `tag.updated`
- `tag.deleted`
- `pool.created`
- `pool.updated`
- `pool.deleted`
- `question.tagged`
- `question.untagged`
- `pool.questions_drawn`

---

## Testing with cURL

### Create Tag
```bash
curl -X POST http://localhost:8000/api/question-tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Calculus",
    "category": "topic",
    "color": "#3b82f6"
  }'
```

### Get Questions with Filters
```bash
curl -X GET "http://localhost:8000/api/questions?exam_id=5&tags=1,3&cognitive_level=apply" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Draw Questions from Pool
```bash
curl -X POST http://localhost:8000/api/exams/5/pools/2/draw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"count": 5}'
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
// Create tag
const response = await axios.post('http://localhost:8000/api/question-tags', {
  name: 'Calculus',
  category: 'topic',
  color: '#3b82f6'
}, {
  headers: { Authorization: `Bearer ${token}` }
});

// Filter questions
const questions = await axios.get('http://localhost:8000/api/questions', {
  params: {
    exam_id: 5,
    tags: '1,3,5',
    cognitive_level: 'apply'
  },
  headers: { Authorization: `Bearer ${token}` }
});
```

### PHP
```php
// Create pool
$response = Http::withToken($token)
    ->post('http://localhost:8000/api/exams/5/pools', [
        'name' => 'Easy Questions',
        'draw_count' => 10,
        'is_active' => true
    ]);

// Draw questions
$questions = Http::withToken($token)
    ->post('http://localhost:8000/api/exams/5/pools/2/draw', [
        'count' => 5
    ]);
```

---

## Support

For API issues or questions:
1. Check status codes and error messages
2. Review validation rules
3. Consult [PHASE_7_IMPLEMENTATION.md](PHASE_7_IMPLEMENTATION.md)
4. Check [PHASE_7_QUICK_REFERENCE.md](PHASE_7_QUICK_REFERENCE.md)

---

**API Version**: 1.0  
**Last Updated**: December 2025  
**Phase**: 7 - Question Organization & Advanced Features
