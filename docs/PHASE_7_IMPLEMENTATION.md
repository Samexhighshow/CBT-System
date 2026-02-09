# Phase 7 Implementation: Question Organization & Advanced Features

## Overview

Phase 7 introduces advanced question organization and metadata management capabilities to the CBT System. This phase focuses on providing instructors with powerful tools to categorize, tag, pool, and manage questions across exams.

**Key Features:**
- 🏷️ **Question Tagging**: Multi-level categorization with colors and categories
- 🎱 **Question Pools**: Group questions for future randomization
- 🧠 **Cognitive Levels**: Bloom's Taxonomy classification
- 📊 **Enhanced Metadata**: Topics, estimated time, author notes
- 📝 **Templates**: Reusable questions across exams
- 🗄️ **Archiving**: Soft deletion without data loss

---

## Database Schema

### Enhanced `exam_questions` Table

#### New Columns

| Column | Type | Description |
|--------|------|-------------|
| `pool_name` | VARCHAR(50) | Pool assignment for randomization |
| `topics` | JSON | Array of topic keywords |
| `author_notes` | TEXT | Internal documentation |
| `usage_count` | INT | Number of times question used |
| `last_used_at` | TIMESTAMP | Last usage timestamp |
| `cognitive_level` | ENUM | Bloom's taxonomy level |
| `estimated_time` | INT | Expected answer time (minutes) |
| `is_template` | BOOLEAN | Template flag for reusability |
| `is_archived` | BOOLEAN | Archive status |

#### Cognitive Levels

```php
enum('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')
```

### New Tables

#### `question_tags` Table

```sql
CREATE TABLE question_tags (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    description TEXT NULL,
    question_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY unique_tag_name (name)
);
```

**Categories**: `topic`, `difficulty`, `format`, `skill`, `other`

#### `question_tag_pivot` Table

```sql
CREATE TABLE question_tag_pivot (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    question_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL,
    FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES question_tags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_question_tag (question_id, tag_id)
);
```

#### `question_pools` Table

```sql
CREATE TABLE question_pools (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    exam_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    question_count INT NOT NULL DEFAULT 0,
    total_marks INT NOT NULL DEFAULT 0,
    draw_count INT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);
```

---

## Backend Implementation

### Models

#### QuestionTag Model

**File**: `backend/app/Models/QuestionTag.php`

**Relationships:**
```php
public function questions(): BelongsToMany
{
    return $this->belongsToMany(Question::class, 'question_tag_pivot');
}
```

**Methods:**
- `updateQuestionCount()`: Sync question count
- `static getByCategory(string $category)`: Get tags by category
- `static getPopular(int $limit = 10)`: Get most used tags

#### QuestionPool Model

**File**: `backend/app/Models/QuestionPool.php`

**Relationships:**
```php
public function exam(): BelongsTo
public function questions(): HasMany
```

**Methods:**
- `updateStats()`: Calculate question count and total marks
- `drawQuestions(int $count)`: Randomly select questions
- `scopeGetActiveForExam($query, $examId)`: Get active pools

#### Question Model Enhancements

**File**: `backend/app/Models/Question.php`

**New Relationships:**
```php
public function tags(): BelongsToMany
public function pool(): ?QuestionPool
```

**New Fillable Fields:**
```php
'pool_name', 'topics', 'author_notes', 'usage_count', 'last_used_at',
'cognitive_level', 'estimated_time', 'is_template', 'is_archived'
```

**New Casts:**
```php
'topics' => 'array',
'last_used_at' => 'datetime',
'is_template' => 'boolean',
'is_archived' => 'boolean'
```

### Controllers

#### QuestionTagController

**File**: `backend/app/Http/Controllers/Api/QuestionTagController.php`

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/question-tags` | List all tags |
| GET | `/api/question-tags/popular` | Get popular tags |
| GET | `/api/question-tags/category/{category}` | Get tags by category |
| POST | `/api/question-tags` | Create new tag |
| PUT | `/api/question-tags/{id}` | Update tag |
| DELETE | `/api/question-tags/{id}` | Delete tag |
| GET | `/api/question-tags/{id}/questions` | Get questions with tag |
| POST | `/api/question-tags/questions/{questionId}/attach` | Attach tags to question |
| DELETE | `/api/question-tags/questions/{questionId}/tags/{tagId}` | Detach tag |

#### QuestionPoolController

**File**: `backend/app/Http/Controllers/Api/QuestionPoolController.php`

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exams/{examId}/pools` | List pools for exam |
| GET | `/api/exams/{examId}/pools/active` | Get active pools |
| POST | `/api/exams/{examId}/pools` | Create pool |
| PUT | `/api/exams/{examId}/pools/{poolId}` | Update pool |
| DELETE | `/api/exams/{examId}/pools/{poolId}` | Delete pool |
| GET | `/api/exams/{examId}/pools/{poolId}/stats` | Get pool statistics |
| POST | `/api/exams/{examId}/pools/{poolId}/draw` | Draw random questions |
| POST | `/api/exams/{examId}/pools/{poolId}/assign` | Assign questions to pool |
| POST | `/api/exams/{examId}/pools/{poolId}/remove` | Remove questions from pool |

#### QuestionController Enhancements

**Enhanced Filtering:**
```php
// Filter by tags
if ($request->has('tags')) {
    $query->whereHas('tags', function ($q) use ($tags) {
        $q->whereIn('question_tags.id', $tags);
    });
}

// Filter by pool
if ($request->has('pool_name')) {
    $query->where('pool_name', $request->pool_name);
}

// Filter by cognitive level
if ($request->has('cognitive_level')) {
    $query->where('cognitive_level', $request->cognitive_level);
}

// Exclude archived questions
if (!$request->boolean('include_archived')) {
    $query->where('is_archived', false);
}
```

---

## Frontend Implementation

### Components

#### TagManager Component

**File**: `frontend/src/components/admin/TagManager.tsx`

**Features:**
- Create/edit/delete tags
- Filter by category
- Color picker with 8 preset colors
- Tag usage statistics
- Bulk tag management

**Props:**
```typescript
interface TagManagerProps {
  onTagsChange?: () => void;
}
```

**Tag Categories:**
- Topic
- Difficulty
- Format
- Skill
- Other

#### TagSelector Component

**File**: `frontend/src/components/admin/TagSelector.tsx`

**Features:**
- Multi-select dropdown
- Search functionality
- Grouped by category
- Visual color indicators
- Select all/clear all
- Keyboard navigation

**Props:**
```typescript
interface TagSelectorProps {
  selectedTagIds: number[];
  onChange: (tagIds: number[]) => void;
  placeholder?: string;
}
```

#### PoolManager Component

**File**: `frontend/src/components/admin/PoolManager.tsx`

**Features:**
- Create/edit/delete pools
- View pool statistics
- Toggle active status
- Draw random questions
- Question assignment management

**Props:**
```typescript
interface PoolManagerProps {
  examId: number;
  onPoolsChange?: () => void;
}
```

**Pool Statistics:**
- Total questions
- Total marks
- Average marks per question
- Draw count

#### QuestionMetadataForm Component

**File**: `frontend/src/components/admin/QuestionMetadataForm.tsx`

**Features:**
- Cognitive level selection (radio buttons)
- Tag selector integration
- Topic/keyword management
- Pool assignment input
- Estimated time input
- Author notes textarea
- Template checkbox

**Props:**
```typescript
interface QuestionMetadataFormProps {
  formData: {
    pool_name?: string;
    topics?: string[];
    cognitive_level?: string;
    estimated_time?: number;
    author_notes?: string;
    is_template?: boolean;
    tag_ids?: number[];
  };
  onChange: (field: string, value: any) => void;
}
```

---

## Usage Examples

### Creating a Tag

```typescript
// TagManager.tsx
const response = await axios.post('http://localhost:8000/api/question-tags', {
  name: 'Calculus',
  category: 'topic',
  color: '#3b82f6',
  description: 'Questions related to calculus concepts'
});
```

### Attaching Tags to Question

```typescript
const response = await axios.post(
  'http://localhost:8000/api/question-tags/questions/123/attach',
  { tag_ids: [1, 2, 3] }
);
```

### Creating a Pool

```typescript
const response = await axios.post(
  'http://localhost:8000/api/exams/5/pools',
  {
    name: 'Easy Questions Pool',
    description: 'Pool of easier questions for warm-up',
    draw_count: 10,
    is_active: true
  }
);
```

### Drawing Random Questions

```typescript
const response = await axios.post(
  'http://localhost:8000/api/exams/5/pools/2/draw',
  { count: 5 }
);
// Returns array of randomly selected questions
```

### Creating Question with Metadata

```typescript
const questionData = {
  exam_id: 5,
  question_text: 'What is the derivative of x²?',
  question_type: 'short_answer',
  marks: 5,
  // Phase 7 fields
  cognitive_level: 'apply',
  pool_name: 'Calculus Pool',
  topics: ['derivatives', 'polynomials'],
  estimated_time: 5,
  author_notes: 'Common calculus question',
  is_template: false,
  tag_ids: [1, 3, 5]
};

const response = await axios.post('http://localhost:8000/api/questions', questionData);
```

### Filtering Questions

```typescript
// Get questions with specific tags
const response = await axios.get('http://localhost:8000/api/questions', {
  params: {
    exam_id: 5,
    tags: '1,3,5', // Tag IDs
    cognitive_level: 'apply',
    pool_name: 'Pool A',
    include_archived: false
  }
});
```

---

## Integration Guide

### 1. Add QuestionMetadataForm to Question Form

```typescript
// In QuestionBank.tsx or question creation modal
import QuestionMetadataForm from './QuestionMetadataForm';

const [formData, setFormData] = useState({
  // ... existing fields
  pool_name: '',
  topics: [],
  cognitive_level: '',
  estimated_time: null,
  author_notes: '',
  is_template: false,
  tag_ids: []
});

// In form JSX
<QuestionMetadataForm
  formData={formData}
  onChange={(field, value) => setFormData({ ...formData, [field]: value })}
/>
```

### 2. Add Tag/Pool Management Pages

```typescript
// In admin dashboard or question bank tabs
<Tabs>
  <Tab label="Questions">
    <QuestionBank />
  </Tab>
  <Tab label="Tags">
    <TagManager onTagsChange={() => fetchQuestions()} />
  </Tab>
  <Tab label="Pools">
    <PoolManager examId={selectedExam} onPoolsChange={() => fetchQuestions()} />
  </Tab>
</Tabs>
```

### 3. Update Question Table Columns

```typescript
// Add new columns to QuestionTable component
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'question_text', label: 'Question' },
  { key: 'question_type', label: 'Type' },
  { key: 'marks', label: 'Marks' },
  { key: 'difficulty', label: 'Difficulty' },
  // Phase 7 columns
  { key: 'cognitive_level', label: 'Cognitive Level' },
  { key: 'pool_name', label: 'Pool' },
  { key: 'tags', label: 'Tags' },
  { key: 'estimated_time', label: 'Est. Time' },
  { key: 'actions', label: 'Actions' }
];
```

---

## Best Practices

### Tagging Strategy

1. **Use Categories Consistently**
   - `topic`: Subject matter (e.g., "Algebra", "Biology")
   - `difficulty`: Complexity level (e.g., "Beginner", "Advanced")
   - `format`: Question format (e.g., "Case Study", "Practical")
   - `skill`: Skills assessed (e.g., "Critical Thinking", "Problem Solving")
   - `other`: Miscellaneous tags

2. **Color Coding**
   - Use consistent colors for similar categories
   - Blue: Topics
   - Green: Skills
   - Red: Difficulty
   - Yellow: Format
   - Purple: Special categories

### Pool Management

1. **Naming Conventions**
   - Use descriptive names: "Easy Warm-up", "Core Concepts", "Advanced Challenge"
   - Include difficulty level: "Pool A (Easy)", "Pool B (Medium)"

2. **Draw Count**
   - Set realistic draw counts based on pool size
   - Ensure draw_count ≤ question_count
   - Use smaller draw counts for testing

3. **Active Status**
   - Only activate pools that are ready for use
   - Deactivate pools during question review
   - Reactivate after quality assurance

### Cognitive Levels

1. **Bloom's Taxonomy Mapping**
   - **Remember**: Basic recall questions
   - **Understand**: Explanation and interpretation
   - **Apply**: Problem-solving with known methods
   - **Analyze**: Break down complex concepts
   - **Evaluate**: Make judgments and assessments
   - **Create**: Produce original work

2. **Distribution**
   - Balance questions across cognitive levels
   - Use analytics to track level distribution
   - Ensure appropriate difficulty progression

### Metadata Management

1. **Topics vs Tags**
   - **Topics**: Specific keywords (free-form, question-specific)
   - **Tags**: Structured categories (predefined, reusable)

2. **Author Notes**
   - Document rationale for answers
   - Note common mistakes
   - Include references to learning materials
   - Mark questions needing review

3. **Templates**
   - Mark reusable questions as templates
   - Use templates for question banks
   - Exclude templates from exam-specific analytics

4. **Estimated Time**
   - Base on average student performance
   - Include reading and answering time
   - Adjust based on feedback

---

## Testing

### Unit Tests

```bash
# Test tag creation and relationships
php artisan test --filter=QuestionTagTest

# Test pool management and randomization
php artisan test --filter=QuestionPoolTest

# Test question filtering with Phase 7 fields
php artisan test --filter=QuestionFilterTest
```

### API Testing

```bash
# Test tag endpoints
curl -X POST http://localhost:8000/api/question-tags \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tag","category":"topic","color":"#3b82f6"}'

# Test pool creation
curl -X POST http://localhost:8000/api/exams/1/pools \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Pool","draw_count":5}'

# Test question filtering
curl "http://localhost:8000/api/questions?tags=1,2&cognitive_level=apply"
```

---

## Migration

### Running the Migration

```bash
cd backend
php artisan migrate --path=database/migrations/2025_12_20_000003_phase7_question_organization.php
```

### Rollback

```bash
php artisan migrate:rollback --step=1
```

---

## Troubleshooting

### Common Issues

1. **Tags Not Showing**
   - Verify tags are created in database
   - Check tag API endpoints are accessible
   - Ensure questions have tags attached

2. **Pool Statistics Incorrect**
   - Run `updateStats()` method on pool model
   - Check questions are properly assigned to pools
   - Verify foreign key relationships

3. **Cognitive Level Not Filtering**
   - Ensure enum values match exactly
   - Check case sensitivity (lowercase)
   - Verify database column type is ENUM

4. **Topics Not Saving**
   - Check JSON casting in model
   - Verify array format in request
   - Ensure database column is JSON type

---

## Performance Optimization

### Indexing

All Phase 7 fields are properly indexed:
- `pool_name` (indexed)
- `cognitive_level` (indexed)
- `is_template` (indexed)
- `is_archived` (indexed)
- `last_used_at` (indexed)

### Eager Loading

Always eager load relationships to avoid N+1 queries:

```php
$questions = Question::with(['exam', 'options', 'tags'])
    ->where('exam_id', $examId)
    ->get();
```

### Caching

Consider caching:
- Popular tags list
- Pool statistics
- Tag counts

---

## Future Enhancements

### Planned Features

1. **Advanced Randomization**
   - Multi-pool randomization
   - Weighted question selection
   - Difficulty-based stratification

2. **Tag Analytics**
   - Tag usage trends
   - Tag correlation analysis
   - Tag recommendation engine

3. **Pool Templates**
   - Reusable pool configurations
   - Cross-exam pool sharing
   - Pool cloning functionality

4. **Question Versioning**
   - Track question changes
   - Restore previous versions
   - Compare question revisions

5. **AI-Powered Features**
   - Auto-tag suggestions
   - Cognitive level prediction
   - Topic extraction from question text

---

## Support

For questions or issues with Phase 7 implementation:

1. Check the [PHASE_7_API_REFERENCE.md](PHASE_7_API_REFERENCE.md)
2. Review [PHASE_7_QUICK_REFERENCE.md](PHASE_7_QUICK_REFERENCE.md)
3. Consult the main [PROJECT_GUIDE.md](PROJECT_GUIDE.md)

---

**Phase 7 Status**: ✅ **COMPLETE** (December 2025)

**Database**: ✅ Migrated  
**Backend**: ✅ Controllers & Models Ready  
**Frontend**: ✅ Components Implemented  
**Documentation**: ✅ Complete  
**Testing**: ⏳ In Progress
