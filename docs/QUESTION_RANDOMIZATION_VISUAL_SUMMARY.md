# Question Randomization System - Visual Summary

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN INTERFACE                              │
│                   (ExamManagement Page)                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Exam List                                                    │  │
│  │  ┌──────────────────────────────┐                             │  │
│  │  │ Exam Name  | Status | Actions│                             │  │
│  │  │ Math Exam  | Draft  | [Edit] │                             │  │
│  │  │            |        │ [🔀] ← NEW: Randomization Button   │  │
│  │  │            |        │ [⋮ More]                            │  │
│  │  └──────────────────────────────┘                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Click Randomization → Opens Modal with QuestionRandomization       │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│           QUESTION RANDOMIZATION CONFIGURATION MODAL                 │
│                     (QuestionRandomization.tsx)                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  [Settings Tab] [Preview Tab] [Stats Tab]                      │ │
│ │                                                                 │ │
│ │  Settings:                                                      │ │
│ │  ○ Fixed     ○ Random                                           │ │
│ │                                                                 │ │
│ │  Total Questions: [30]                                          │ │
│ │                                                                 │ │
│ │  ☑ Use Difficulty Distribution                                 │ │
│ │    Easy: [10]  Medium: [15]  Hard: [5]                         │ │
│ │                                                                 │ │
│ │  ☑ Shuffle Question Order                                       │ │
│ │  ☑ Shuffle Options (MCQ)                                        │ │
│ │                                                                 │ │
│ │  Distribution: ○ Same for all ○ Unique per student             │ │
│ │                                                                 │ │
│ │  [Save Settings] [Generate Preview] [Lock Questions]           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                        [Save Settings]
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API: PUT /exams/{id}/randomization               │
│                                                                       │
│  Request Body: {                                                    │
│    question_selection_mode: "random",                              │
│    total_questions_to_serve: 30,                                   │
│    difficulty_distribution: {easy: 10, medium: 15, hard: 5},      │
│    shuffle_question_order: true,                                   │
│    shuffle_option_order: true,                                     │
│    question_distribution: "unique_per_student",                    │
│    ...                                                              │
│  }                                                                  │
│                                                                       │
│  Response: Updated exam with new randomization fields              │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE: exams table                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  id  | title  | ...  | question_selection_mode: "random"    │  │
│  │  1   | Math   | ...  | total_questions_to_serve: 30          │  │
│  │      |        | ...  | difficulty_distribution: {e:10...}   │  │
│  │      |        | ...  | shuffle_question_order: true          │  │
│  │      |        | ...  | question_distribution: "unique"       │  │
│  │      |        | ...  | questions_locked: false              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                        [Lock Questions]
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  API: POST /exams/{id}/randomization/lock           │
│  Sets: questions_locked = true, questions_locked_at = now()        │
│  Effect: Prevents further modifications to settings                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Student Exam Flow

```
┌──────────────────────┐
│   Student Login      │
│  (Auth Successful)   │
└──────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  Student sees available exams                    │
│  Click "Start Exam" on published exam            │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ API: GET /exams/{id}/randomization/selection    │
│                                                  │
│ Backend QuestionSelectionService:               │
│ 1. Check if student already has selection       │
│    - If yes: return existing                    │
│    - If no: generate new                        │
│                                                  │
│ 2. If mode="random" + unique_per_student:       │
│    - Get all questions for exam                 │
│    - Apply difficulty filters                  │
│    - Randomly select: 10 easy, 15 med, 5 hard  │
│    - Apply reuse policy (no duplicates)         │
│    - Shuffle question order                     │
│    - Shuffle MCQ options                        │
│                                                  │
│ 3. Save to exam_question_selections table       │
│    - Store question_ids array                   │
│    - Store option_shuffles mapping              │
│    - Store distribution_summary                 │
│                                                  │
│ 4. Return: {selection, questions[], exam}       │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│    Exam Portal displays ONLY selected questions │
│                                                  │
│    Question 1 (from selection[0])               │
│    - Title: "What is 2+2?"                      │
│    - Options: [B, A, D, C]  ← Shuffled order   │
│    [A] 3   [B] 4   [C] 5   [D] 6               │
│                                                  │
│    Question 2 (from selection[1])               │
│    - Title: "What is 5×3?"                      │
│    - Options: [D, B, A, C]  ← Different order   │
│    [A] 10  [B] 15  [C] 20  [D] 25              │
│    ...                                           │
│    (Only 30 out of 100+ questions shown)        │
│                                                  │
│    [Submit Exam]                                │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  Student 2 starts same exam:                     │
│  - Gets DIFFERENT 30 questions (unique_per_      │
│    student mode)                                 │
│  - Same difficulty distribution (10/15/5)       │
│  - Questions in different order                 │
│  - Options shuffled differently                 │
│                                                  │
│  Example:                                        │
│  Student 1: Questions [1,5,12,3,8,...]          │
│  Student 2: Questions [2,7,9,4,11,...]  ← Unique
│  Student 3: Questions [6,8,10,1,13,...]← Unique │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│  Scoring & Results                               │
│  - Only count answers for questions in selection │
│  - Store which questions were shown              │
│  - Calculate score based on correct answers      │
│  - Show results to student (if released)         │
└──────────────────────────────────────────────────┘
```

## Question Distribution Examples

### Example 1: Difficulty Distribution
```
Total Available Questions: 100
├─ Easy: 30 questions
├─ Medium: 40 questions
└─ Hard: 30 questions

Configuration:
  Total to Serve: 30
  Difficulty: Easy=10, Medium=15, Hard=5

Selection Algorithm:
  1. Filter available easy questions: [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31...]
  2. Randomly pick 10: [1, 7, 15, 3, 21, 9, 27, 5, 31, 13]
  
  3. Filter available medium questions: [2,4,6,8,10,12,14,16,18,20...]
  4. Randomly pick 15: [2, 18, 10, 8, 20, 4, 16, 6, 14, 12, 22, 24, 26, 28, 30]
  
  5. Filter available hard questions: [32,34,36,38,40,42,44,46,48,50...]
  6. Randomly pick 5: [32, 44, 36, 50, 38]

Result: 30 questions (10 easy + 15 medium + 5 hard)
```

### Example 2: Marks Distribution
```
Total Available Questions: 200
├─ 2-mark questions: 50 questions
├─ 5-mark questions: 100 questions
└─ 10-mark questions: 50 questions

Configuration:
  Total to Serve: 20 questions
  Marks Distribution:
    - 2 marks: 10 questions (20 total marks)
    - 5 marks: 5 questions (25 total marks)
    - 10 marks: 5 questions (50 total marks)
  Total: 20 questions, 95 marks

Selection Algorithm:
  1. Filter 2-mark questions, randomly pick 10
  2. Filter 5-mark questions, randomly pick 5
  3. Filter 10-mark questions, randomly pick 5
  
Result: 20 questions totaling 95 marks
```

## Option Shuffling Example

```
Original Question 5 (Multiple Choice):
Question: "Which is the capital of France?"
A) London
B) Paris
C) Berlin
D) Madrid

Student 1 receives (shuffled):
  option_shuffles[5] = [3, 1, 4, 2]  ← Maps to original positions
  Display order:
  A) Berlin     (original position C)
  B) London     (original position A)
  C) Madrid     (original position D)
  D) Paris      (original position B)

Student 2 receives (shuffled):
  option_shuffles[5] = [2, 4, 1, 3]  ← Different shuffle
  Display order:
  A) Paris      (original position B)
  B) Madrid     (original position D)
  C) London     (original position A)
  D) Berlin     (original position C)

When grading: System knows original positions and correct answer is always B (Paris)
regardless of display order for each student
```

## Question Selection Sequence Diagram

```
Admin Clicks "Configure Randomization"
    ↓
Load /exams/{id}/randomization/stats
    ↓ [Settings loaded, questions_locked=false, allows modification]
    ↓
Set configuration:
  - Mode: Random
  - Total: 30
  - Difficulty: Easy 10, Medium 15, Hard 5
  - Shuffle: Yes
  - Distribution: Unique per student
    ↓
[Optional: Generate Preview]
    ↓ GET /exams/{id}/randomization/preview
    ↓ [Validate distribution, show sample]
    ↓ [Success: "Valid, ready to lock"]
    ↓
[Save Settings]
    ↓ PUT /exams/{id}/randomization
    ↓ [Settings saved to exams table]
    ↓
[Lock Questions]
    ↓ POST /exams/{id}/randomization/lock
    ↓ [questions_locked=true, timestamp set]
    ↓ [Prevents further modifications]
    ↓
Publish Exam
    ↓
Students start exam...
    ↓
GET /exams/{id}/randomization/selection (per student)
    ↓ [QuestionSelectionService generates on-demand]
    ↓
Save selection to exam_question_selections table
    ↓ [question_ids, option_shuffles, distribution_summary]
    ↓
Display 30 questions to student (unique set if configured)
    ↓
Student submits exam
    ↓
Grade exam (only score questions in selection)
```

## File Structure

```
CBT-System/
├── backend/
│   ├── app/
│   │   ├── Http/
│   │   │   └── Controllers/
│   │   │       └── ExamQuestionRandomizationController.php  ✅ NEW
│   │   ├── Models/
│   │   │   ├── Exam.php  [UPDATED: +relationships, +fields]
│   │   │   └── ExamQuestionSelection.php  ✅ NEW
│   │   └── Services/
│   │       └── QuestionSelectionService.php  ✅ NEW (~350 lines)
│   ├── database/
│   │   └── migrations/
│   │       ├── 2025_12_22_141025_add_question_randomization_to_exams_table.php
│   │       └── 2025_12_22_141037_create_exam_question_selections_table.php
│   └── routes/
│       └── api.php  [UPDATED: +6 routes]
│
├── frontend/
│   └── src/
│       ├── components/
│       │   └── QuestionRandomization.tsx  ✅ NEW (~900 lines)
│       ├── pages/
│       │   └── admin/
│       │       └── ExamManagement.tsx  [NEEDS INTEGRATION]
│       └── services/
│           └── api.ts  [no changes needed, routes handle]
│
├── QUESTION_RANDOMIZATION_GUIDE.md  ✅ NEW (for admins)
├── RANDOMIZATION_INTEGRATION_GUIDE.md  ✅ NEW (for developers)
└── RANDOMIZATION_IMPLEMENTATION_STATUS.md  ✅ NEW (this overview)
```

## State Management & Data Flow

```
ExamManagement (Parent)
    ↓
    [selectedExamForRandomization state]
    [showRandomizationModal state]
    ↓
QuestionRandomization (Child)
    ↓
    [settings state] ← from API GET /stats
    [stats state]
    [preview state]
    [easyCount, mediumCount, hardCount states]
    [marksDistribution state]
    [useDifficultyDistribution toggle]
    [useMarksDistribution toggle]
    ↓
API Calls:
  • GET /exams/{id}/randomization/stats → loads initial state
  • PUT /exams/{id}/randomization → saves settings
  • GET /exams/{id}/randomization/preview → validates
  • POST /exams/{id}/randomization/lock → freezes
  • POST /exams/{id}/randomization/unlock → allows changes
    ↓
Database Updates:
  exams table fields modified:
  - question_selection_mode
  - total_questions_to_serve
  - shuffle_question_order
  - shuffle_option_order
  - question_distribution
  - difficulty_distribution
  - marks_distribution
  - topic_filters
  - question_reuse_policy
  - questions_locked
  - questions_locked_at
```

## Success Criteria Checklist

```
✅ COMPLETED ITEMS:
  ✅ Backend service fully implements randomization logic
  ✅ API endpoints handle all randomization operations
  ✅ Database schema supports question selection tracking
  ✅ Frontend component provides admin configuration UI
  ✅ Migration scripts created and tested
  ✅ Model relationships set up correctly
  ✅ Lock/unlock workflow implemented
  ✅ Validation and error handling in place
  ✅ Documentation written for admins and developers
  
🔄 IN PROGRESS:
  🔄 Integration with ExamManagement page
  
⏳ TO DO:
  ⏳ Update exam portal to use randomized questions
  ⏳ End-to-end testing with real exams
  ⏳ Performance optimization if needed
  ⏳ Student feedback collection
```

---

## Legend

```
✅ Complete & Tested
🔄 In Progress
⏳ Pending
⚠️ Known Issue
🐛 Bug
📝 Documentation
🚀 Ready for Production
```
