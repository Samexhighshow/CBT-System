# PHASE 5: QUICK REFERENCE GUIDE

**Quick lookup for Phase 5 implementation**

---

## 🚀 Quick Start

### Run Tests
```bash
php artisan test tests/Feature/Api/QuestionAdminActionsTest.php
```

### Run Migration
```bash
php artisan migrate
```

### Deploy
```bash
php artisan migrate && php artisan cache:clear
```

---

## 📡 API Endpoints at a Glance

### Create & Edit
```
POST   /api/questions                    → Create question
PUT    /api/questions/{id}               → Edit question
```

### Clone & Status
```
POST   /api/questions/{id}/duplicate     → Clone question
PATCH  /api/questions/{id}/toggle-status → Toggle active/disabled
```

### Delete
```
DELETE /api/questions/{id}               → Delete single
POST   /api/questions/bulk-delete        → Delete multiple
```

### Bulk Operations
```
POST   /api/questions/bulk-status        → Update status
POST   /api/questions/reorder            → Reorder questions
```

### Preview & Statistics
```
GET    /api/questions/{id}/preview       → Student preview
GET    /api/questions/statistics/exam/{id} → Exam stats
```

### Grouping
```
POST   /api/questions/group/by/{examId}  → Group questions
```

---

## 🔧 Controller Methods

**File**: `app/Http/Controllers/Api/QuestionController.php`

```php
// Phase 3/4 (Existing)
public function store(StoreQuestionRequest $request) { }
public function update($id, UpdateQuestionRequest $request) { }

// Phase 5 (New)
public function duplicate($id) { }
public function destroy($id) { }
public function toggleStatus($id) { }
public function reorderQuestions(Request $request) { }
public function preview($id) { }
public function bulkDestroy(Request $request) { }
public function bulkUpdateStatus(Request $request) { }
public function groupQuestions($examId, Request $request) { }
public function getExamStatistics($examId) { }
```

---

## 🗄️ Database Changes

**Migration**: `2025_12_20_000002_phase5_admin_actions_support.php`

**New Columns**:
- `exam_questions.order_index` (integer) - Question ordering
- `exam_questions.section_name` (varchar) - Section grouping

**Run**: `php artisan migrate`

---

## ✅ Model Updates

### Question Model
```php
// Updated fillable
protected $fillable = [
    // ... existing fields ...
    'order_index',
    'section_name'
];
```

### Exam Model
```php
// New helper methods
questionsWithOptions()          // Get with options
getStatistics()                 // Comprehensive stats
canDeleteQuestion($q)           // Permission check
canEditQuestion($q)             // Permission check
canDuplicateQuestion($q)        // Permission check
previewQuestion($q)             // Student format
getQuestionsByType()            // Group by type
getQuestionsByDifficulty()      // Group by difficulty
```

---

## 📝 Validation

**For Create**: `StoreQuestionRequest`
- Type-specific validation
- Mark validation against exam total
- Option validation

**For Update**: `UpdateQuestionRequest`
- Type change validation
- Closed exam checks
- Mark adjustment validation

**Rules**: `app/Rules/` (11 custom rules)

---

## 🧪 Test Cases (28 Total)

### By Feature
```
Duplicate:           2 tests
Toggle Status:       2 tests
Delete:              2 tests
Reorder:             2 tests
Bulk Delete:         2 tests
Bulk Update Status:  2 tests
Preview:             1 test
Group:               1 test
Statistics:          1 test
Error Handling:      8+ tests
Edge Cases:          5+ tests
```

### Run Specific Test
```bash
php artisan test tests/Feature/Api/QuestionAdminActionsTest.php::test_duplicate_question_successfully
```

---

## 🔐 Permissions

**All Phase 5 endpoints require**:
- ✅ Authenticated user
- ✅ Admin role
- ✅ Exam not closed (for modifications)

---

## 📊 Response Format

### Success (200/201)
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error (422)
```json
{
  "message": "Error description",
  "errors": {
    "field": ["Validation error"]
  }
}
```

### Not Found (404)
```json
{
  "message": "Resource not found",
  "error": "Question not found"
}
```

---

## 💾 Database Transactions

All write operations use transactions:
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

## 🧠 Common Patterns

### Duplicate Question
```bash
POST /api/questions/42/duplicate
# Returns: new question with id = 43, status = draft
```

### Toggle Status
```bash
PATCH /api/questions/42/toggle-status
# Returns: previous_status, new_status
```

### Reorder
```bash
POST /api/questions/reorder
{
  "questions": [
    {"id": 1, "order": 3},
    {"id": 2, "order": 1},
    {"id": 3, "order": 2}
  ]
}
```

### Preview
```bash
GET /api/questions/42/preview
# Returns: student-safe version (no correct answers)
```

### Group
```bash
POST /api/questions/group/by/1
{
  "group_by": "question_type"
}
# Returns: grouped structure with counts
```

### Statistics
```bash
GET /api/questions/statistics/exam/1
# Returns: comprehensive statistics
```

---

## ⚠️ Important Notes

1. **Closed Exams**: Cannot modify (add/edit/delete/reorder)
2. **Duplicate**: Always sets draft status
3. **Bulk Operations**: Atomic (all or nothing)
4. **Preview**: Hides correct answers
5. **Statistics**: Includes type/difficulty/status breakdown

---

## 🐛 Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 404 | Not found | Check ID exists |
| 422 | Validation error | Check constraints |
| 422 | Exam closed | Use different exam |
| 500 | Server error | Check logs |

---

## 📚 Documentation Links

- **Full API Docs**: [PHASE_5_ADMIN_ACTIONS_API.md](docs/PHASE_5_ADMIN_ACTIONS_API.md)
- **Checklist**: [PHASE_5_IMPLEMENTATION_CHECKLIST.md](docs/PHASE_5_IMPLEMENTATION_CHECKLIST.md)
- **Summary**: [PHASE_5_FINAL_SUMMARY.md](docs/PHASE_5_FINAL_SUMMARY.md)

---

## 🎯 Postman Quick Test

```bash
# Create exam
POST http://localhost:8000/api/exams
{
  "title": "Test Exam",
  "subject": "Math"
}

# Create question
POST http://localhost:8000/api/questions
{
  "exam_id": 1,
  "question_text": "2+2=?",
  "question_type": "multiple_choice_single",
  "marks": 5,
  "options": [
    {"option_text": "4", "is_correct": true},
    {"option_text": "5", "is_correct": false}
  ]
}

# Duplicate
POST http://localhost:8000/api/questions/1/duplicate

# Preview
GET http://localhost:8000/api/questions/1/preview

# Statistics
GET http://localhost:8000/api/questions/statistics/exam/1

# Group
POST http://localhost:8000/api/questions/group/by/1
{
  "group_by": "question_type"
}
```

---

## 🔍 Debugging

### Check Logs
```bash
tail -f storage/logs/laravel.log
```

### Run Single Test
```bash
php artisan test tests/Feature/Api/QuestionAdminActionsTest.php::test_name
```

### Check Routes
```bash
php artisan route:list | grep questions
```

### Check Database
```bash
mysql> DESCRIBE exam_questions;
# Verify order_index and section_name columns exist
```

---

## 📦 Files Modified

1. `app/Http/Controllers/Api/QuestionController.php` (+400 lines)
2. `routes/api.php` (+8 lines)
3. `app/Models/Exam.php` (+150 lines)
4. `app/Models/Question.php` (+2 lines)
5. `database/migrations/2025_12_20_000002_*.php` (new)
6. `tests/Feature/Api/QuestionAdminActionsTest.php` (new)

---

## ✨ Phase 5 Complete!

All 10 features implemented, tested, and documented.

**Ready for**:
- ✅ Testing
- ✅ Migration
- ✅ Deployment
- ✅ Frontend Integration

---

**Quick Reference v1.0** | **December 20, 2025**
