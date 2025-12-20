# Phase 7 Quick Reference

Quick commands and examples for Phase 7 features.

## Database

```bash
# Run Phase 7 migration
cd backend
php artisan migrate --path=database/migrations/2025_12_20_000003_phase7_question_organization.php

# Rollback
php artisan migrate:rollback --step=1
```

## Tags

### Create Tag
```bash
POST /api/question-tags
{
  "name": "Calculus",
  "category": "topic",
  "color": "#3b82f6",
  "description": "Questions about calculus"
}
```

### Get All Tags
```bash
GET /api/question-tags
```

### Filter by Category
```bash
GET /api/question-tags/category/topic
```

### Attach Tags to Question
```bash
POST /api/question-tags/questions/123/attach
{
  "tag_ids": [1, 2, 3]
}
```

### Detach Tag
```bash
DELETE /api/question-tags/questions/123/tags/1
```

## Pools

### Create Pool
```bash
POST /api/exams/5/pools
{
  "name": "Easy Questions",
  "description": "Pool of easier questions",
  "draw_count": 10,
  "is_active": true
}
```

### Get Pools for Exam
```bash
GET /api/exams/5/pools
```

### Get Pool Statistics
```bash
GET /api/exams/5/pools/2/stats
```

### Draw Random Questions
```bash
POST /api/exams/5/pools/2/draw
{
  "count": 5
}
```

### Assign Questions to Pool
```bash
POST /api/exams/5/pools/2/assign
{
  "question_ids": [1, 2, 3, 4, 5]
}
```

## Questions

### Create Question with Phase 7 Fields
```bash
POST /api/questions
{
  "exam_id": 5,
  "question_text": "What is the derivative of x²?",
  "question_type": "short_answer",
  "marks": 5,
  "cognitive_level": "apply",
  "pool_name": "Calculus Pool",
  "topics": ["derivatives", "polynomials"],
  "estimated_time": 5,
  "author_notes": "Common calculus question",
  "is_template": false,
  "tag_ids": [1, 3, 5]
}
```

### Filter Questions
```bash
GET /api/questions?exam_id=5&tags=1,3,5&cognitive_level=apply&pool_name=Pool+A
```

### Exclude Archived
```bash
GET /api/questions?exam_id=5&include_archived=false
```

### Templates Only
```bash
GET /api/questions?templates_only=true
```

## Cognitive Levels

```
remember     - Recall facts and basic concepts
understand   - Explain ideas or concepts
apply        - Use information in new situations
analyze      - Draw connections among ideas
evaluate     - Justify a decision
create       - Produce new or original work
```

## Tag Categories

```
topic       - Subject matter
difficulty  - Complexity level
format      - Question format
skill       - Skills assessed
other       - Miscellaneous
```

## Frontend Components

### TagManager
```tsx
import TagManager from './components/admin/TagManager';

<TagManager onTagsChange={() => refreshQuestions()} />
```

### TagSelector
```tsx
import TagSelector from './components/admin/TagSelector';

<TagSelector
  selectedTagIds={[1, 2, 3]}
  onChange={(ids) => setSelectedTags(ids)}
  placeholder="Select tags..."
/>
```

### PoolManager
```tsx
import PoolManager from './components/admin/PoolManager';

<PoolManager
  examId={5}
  onPoolsChange={() => refreshQuestions()}
/>
```

### QuestionMetadataForm
```tsx
import QuestionMetadataForm from './components/admin/QuestionMetadataForm';

<QuestionMetadataForm
  formData={formData}
  onChange={(field, value) => handleChange(field, value)}
/>
```

## Quick Tips

### Best Tag Usage
- Use **tags** for broad, reusable categories
- Use **topics** for specific question keywords
- Limit tags to 3-5 per question
- Consistent color coding per category

### Pool Strategy
- Name pools descriptively
- Set draw_count ≤ question_count
- Use active status to control availability
- Update stats after adding questions

### Metadata Guidelines
- Set cognitive level for all questions
- Use estimated_time for time management
- Add author_notes for complex questions
- Mark reusable questions as templates

### Performance
- Always eager load: `with(['tags', 'pool'])`
- Use indexes for filtering
- Cache popular tags list
- Batch tag assignments

## Common Queries

### Get questions with specific tags AND cognitive level
```php
Question::with('tags')
    ->whereHas('tags', function($q) {
        $q->whereIn('question_tags.id', [1, 2, 3]);
    })
    ->where('cognitive_level', 'apply')
    ->get();
```

### Get active pools with question count > 5
```php
QuestionPool::where('is_active', true)
    ->where('question_count', '>', 5)
    ->get();
```

### Get questions from pool ordered by difficulty
```php
Question::where('pool_name', 'Pool A')
    ->orderByRaw("FIELD(difficulty_level, 'easy', 'medium', 'hard')")
    ->get();
```

### Get popular tags (>10 questions)
```php
QuestionTag::where('question_count', '>', 10)
    ->orderBy('question_count', 'desc')
    ->get();
```

## Testing

```bash
# Test tag endpoints
curl -X GET http://localhost:8000/api/question-tags

# Test pool creation
curl -X POST http://localhost:8000/api/exams/1/pools \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","draw_count":5}'

# Test question filtering
curl "http://localhost:8000/api/questions?cognitive_level=apply"
```

## Troubleshooting

### Tags not showing
```php
// Check relationship
$question->load('tags');

// Manually attach
$question->tags()->attach([1, 2, 3]);
```

### Pool stats incorrect
```php
$pool->updateStats();
```

### Questions not filtering by topic
```php
// Topics is JSON array
$query->whereJsonContains('topics', 'calculus');
```

## File Locations

```
backend/
  app/Models/
    QuestionTag.php
    QuestionPool.php
  app/Http/Controllers/Api/
    QuestionTagController.php
    QuestionPoolController.php
  database/migrations/
    2025_12_20_000003_phase7_question_organization.php
  routes/
    api.php

frontend/src/components/admin/
  TagManager.tsx
  TagSelector.tsx
  PoolManager.tsx
  QuestionMetadataForm.tsx
```

---

**Quick Start**: Run migration → Create tags → Create pools → Add questions with metadata → Filter and organize!
