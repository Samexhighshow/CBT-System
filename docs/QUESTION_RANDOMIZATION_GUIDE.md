# Question Randomization & Selection System

## Overview

The Question Randomization & Selection System allows administrators to:
- Serve a subset of questions (e.g., 30 out of 200+) to students
- Shuffle questions and options for fairness
- Distribute questions by difficulty or marks
- Ensure unique questions per student or same questions for all
- Lock selections to prevent modifications during exam

## Key Features

### 1. Question Selection Mode

#### Fixed Mode (Default)
- All students receive **the same set of questions** manually selected for the exam
- Use when you want consistent, controlled testing

#### Random Mode
- Select questions **dynamically** from the question bank based on rules
- Questions are selected at exam start time (per student if unique mode)
- More flexible for large question banks

### 2. Question Distribution

#### Total Questions to Serve
- Specify exact number of questions to deliver
- Default: All available questions in the exam
- **Example**: Exam has 200 questions, but only 30 are served to each student

#### Difficulty-Based Distribution
- Define how many questions of each difficulty level
- **Example**: 
  - 10 Easy questions (2 marks each)
  - 15 Medium questions (3 marks each)
  - 5 Hard questions (5 marks each)
  - Total: 30 questions, 85 marks

#### Marks-Based Distribution
- Define distribution by question marks
- **Example**:
  - 10 questions worth 2 marks = 20 marks
  - 5 questions worth 5 marks = 25 marks
  - 3 questions worth 10 marks = 30 marks
  - Total: 18 questions, 75 marks

### 3. Shuffling Options

#### Shuffle Question Order
- Changes the order of questions for each student or session
- Prevents students from helping each other by memorizing positions

#### Shuffle Option Order
- For MCQ/Multiple Choice questions only
- Randomizes the position of answer options
- **Example**: Option C might be position 2 for one student, position 4 for another

### 4. Question Distribution Strategy

#### Same Questions for All
- Every student gets the same 30 questions
- Questions appear in same or shuffled order (based on setting)
- **Use case**: Standardized testing with comparable scores

#### Unique Questions per Student
- Each student gets a different set of 30 questions from the pool
- Maintains difficulty/marks distribution if configured
- **Use case**: Prevent cheating, ensure fairness in large exams
- **Requirement**: Must have enough questions (if requesting unique, each student needs different questions)

### 5. Question Reuse Policy

#### Allow Reuse
- If unique per student is enabled, earlier students' used questions can be assigned to later students
- **Risk**: If many students take exam, later students might get similar sets
- **Benefit**: Works when question pool is limited

#### No Reuse Until Exhausted
- Each question is used only once per exam attempt
- System tries to avoid reusing questions until pool is exhausted
- **Benefit**: Maximum diversity
- **Risk**: May fail if not enough questions

### 6. Topic Filtering (Optional)

- Include only questions tagged with specific topics
- **Example**: If exam covers "Algebra" and "Calculus", filter questions by these tags
- System respects topic filter when selecting random questions

### 7. Question Locking

#### Purpose
- Freeze randomization settings before exam starts
- Ensures all students get consistent question assignment
- Prevents accidental modifications mid-exam

#### Actions
- **Lock Questions**: Prevents any changes to randomization settings
- **Unlock Questions**: Allows modifications (existing selections are deleted and regenerated)

## Implementation Details

### Database Schema

#### `exams` table additions:
```sql
- question_selection_mode (enum: fixed, random)
- total_questions_to_serve (int)
- shuffle_question_order (boolean)
- shuffle_option_order (boolean)
- question_distribution (enum: same_for_all, unique_per_student)
- difficulty_distribution (json: {easy: 10, medium: 15, hard: 5})
- marks_distribution (json: {2: 10, 5: 5, 10: 3})
- topic_filters (json: ["Algebra", "Calculus"])
- question_reuse_policy (enum: allow_reuse, no_reuse_until_exhausted)
- questions_locked (boolean)
- questions_locked_at (datetime)
```

#### `exam_question_selections` table:
Tracks which questions each student receives
```sql
- id
- exam_id
- student_id / user_id
- question_ids (json array of question IDs in order)
- option_shuffles (json: {question_id: [shuffled_option_ids]})
- total_questions
- total_marks
- distribution_summary (json)
- is_locked
- locked_at
```

### Selection Algorithm

**Random Selection Process:**

1. Get all active, non-archived questions from exam
2. Apply topic filters (if configured)
3. If difficulty distribution:
   - Select required count of each difficulty
   - Respect availability constraints
4. If marks distribution:
   - Select required count of each marks level
   - Ensure total matches requested
5. If unique per student:
   - Apply reuse policy
   - Try to avoid previously used questions
6. If shuffle enabled:
   - Randomize question order
   - Randomize option order per question
7. Store selection in `exam_question_selections` table
8. Lock selection when exam is submitted

### Usage Statistics

System tracks:
- `usage_count` per question (how many students answered it)
- `last_used_at` timestamp
- Used for:
  - Reuse policy decisions
  - Question difficulty calibration
  - Item analysis

## Frontend Integration

### Admin Interface (Question Randomization Component)

Located: `frontend/src/pages/admin/QuestionRandomization.tsx`

#### Settings Tab
- Configure selection mode, distribution, shuffling
- Set difficulty/marks distribution
- Apply topic filters
- Configure reuse policy
- Save settings (if not locked)

#### Preview Tab
- Generate sample of what exam will look like
- Show validation errors/warnings
- Display distribution breakdown
- Show sample questions

#### Statistics Tab
- Current exam configuration
- Available questions by difficulty/marks
- Number of selections generated
- Lock status

### API Endpoints

```
PUT    /exams/{id}/randomization
       Update randomization settings

GET    /exams/{id}/randomization/preview
       Generate preview of question selection

GET    /exams/{id}/randomization/stats
       Get exam and selection statistics

POST   /exams/{id}/randomization/lock
       Lock exam questions (freeze settings)

POST   /exams/{id}/randomization/unlock
       Unlock exam questions (allow modifications)

GET    /exams/{id}/randomization/selection
       Get question selection for current user/student
       Query params: student_id, user_id
```

## Workflow

### As an Administrator

1. **Create Exam**
   - Add questions to exam (100+ questions in question bank)

2. **Configure Randomization**
   - Go to Exam Management → Randomization
   - Choose selection mode (fixed or random)
   - If random:
     - Set total questions (30 out of 100)
     - Choose distribution (difficulty or marks-based)
     - Enable shuffling if desired
     - Choose unique or same questions for all

3. **Preview Configuration**
   - Click "Generate Preview"
   - Verify distribution is valid
   - Check sample questions
   - Fix errors if any

4. **Lock Configuration**
   - Click "Lock Questions" when ready
   - Prevents accidental modifications

5. **Publish Exam**
   - Exam ready for students

### As a Student

1. **Start Exam**
   - System generates question selection:
     - Pulls 30 questions matching distribution rules
     - Shuffles if configured
     - Shuffles options if configured
     - Stores selection for this student

2. **Take Exam**
   - Sees only assigned 30 questions (out of 100+ available)
   - Questions/options appear in randomized order (if enabled)
   - Other students see different questions (if unique mode)

3. **Submit Exam**
   - Only answers to assigned 30 questions are scored
   - System locks the selection for grading

## Examples

### Example 1: SAT-Style Exam (Same Questions, All Students)

**Setup:**
- Question Bank: 150 questions
- Selection Mode: Fixed OR Random (same_for_all)
- Total Questions: 30
- Shuffling: Yes (both question order and options)
- Distribution: None (just random 30)

**Result:** All students get same 30 questions, but in randomized order and with shuffled options

---

### Example 2: Competitive Exam (Unique Questions, Difficulty-Based)

**Setup:**
- Question Bank: 500 questions (200 easy, 200 medium, 100 hard)
- Selection Mode: Random
- Question Distribution: unique_per_student
- Difficulty Distribution: Easy=10, Medium=15, Hard=5 (30 total)
- Shuffling: Yes
- Reuse Policy: Allow reuse (since 500 questions can support many students)

**Result:** 
- Each student gets 30 unique questions
- Each student's exam has 10 easy, 15 medium, 5 hard
- Questions appear in different order for each student
- Options are shuffled per student

---

### Example 3: Marks-Based Placement Test

**Setup:**
- Question Bank: 200 questions
- Selection Mode: Random
- Question Distribution: same_for_all
- Marks Distribution: 5 questions (2 marks) + 10 questions (3 marks) + 5 questions (5 marks)
- Total Marks: 65
- Total Questions: 20
- Shuffling: Yes (questions only, not options)

**Result:**
- All students get same 20 questions
- 5 questions worth 2 marks (10 marks)
- 10 questions worth 3 marks (30 marks)
- 5 questions worth 5 marks (25 marks)
- Questions appear in different order for each student

---

### Example 4: Large Exam Pool (No Reuse)

**Setup:**
- Question Bank: 1000 questions
- Selection Mode: Random
- Question Distribution: unique_per_student
- Total Questions: 50
- Difficulty Distribution: Easy=15, Medium=20, Hard=15
- Reuse Policy: No reuse until exhausted
- Expected Students: 100

**Result:**
- Each student gets 50 unique questions
- Respects difficulty distribution
- Maximum diversity (no question is used twice)
- System needs to ensure 5000 questions available (50 × 100)
- If only 1000 available, system will warn or error

## Validation Rules

### Difficulty Distribution Validation
- Sum of easy + medium + hard = total_questions_to_serve
- Each difficulty count ≤ available questions of that difficulty
- At least one question in each difficulty level specified

### Marks Distribution Validation
- Sum of all (marks × count) = total marks
- Sum of all counts = total_questions_to_serve
- Each marks value must exist in question bank

### Unique Per Student Validation
- Total available questions ≥ (students_count × total_questions)
- If no_reuse_until_exhausted: strict check
- If allow_reuse: system will warn if approaching limit

### Topic Filter Validation
- Only apply filters if topics exist in questions
- Show warning if filter too restrictive (no questions match)

## Error Handling

### Errors
- **Not enough questions**: More requested than available
- **Invalid distribution**: Distribution doesn't match totals
- **Distribution mismatch**: Difficulty distribution sum ≠ total questions
- **Locked settings**: Cannot modify when questions are locked

### Warnings
- **Low question availability**: Few questions left for unique per student
- **Uneven distribution**: Some difficulty levels have no questions
- **Topic filter too restrictive**: No questions match filter

## Troubleshooting

### Problem: "Not enough easy questions"
**Solution:** Reduce requested easy count or add more easy questions to bank

### Problem: "Distribution total doesn't match"
**Solution:** Ensure sum of (easy + medium + hard) equals total questions

### Problem: "Cannot modify - questions locked"
**Solution:** Click "Unlock Questions" button to unlock (existing selections deleted)

### Problem: "Unique per student failing for many students"
**Solution:** 
- Increase question bank size
- Reduce questions_to_serve
- Switch to allow_reuse policy
- Use same_for_all mode instead

## Performance Considerations

- **Large Question Banks**: Selection queries optimized with indexes
- **Large Student Count**: Selections cached after first generation
- **Shuffling**: Performed once at exam start, stored for re-use
- **Preview**: Generated on-demand without saving

## Best Practices

1. **Always Preview** before publishing exam with randomization
2. **Lock Questions** once satisfied with configuration
3. **Test with Sample** of expected student count
4. **Monitor Usage** stats to calibrate difficulty levels
5. **Document Settings** for future exam iterations
6. **Backup Exams** before major configuration changes

## Future Enhancements

- [ ] Adaptive difficulty (adjust based on student performance)
- [ ] Weighted random selection
- [ ] Question performance metrics in preview
- [ ] A/B testing (different question sets)
- [ ] Item analysis and psychometric data
- [ ] Time-based question allocation
