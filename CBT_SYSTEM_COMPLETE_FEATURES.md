# CBT System - Complete Features Documentation

> **Comprehensive Computer-Based Testing Platform for Schools**  
> Version: 2.0 | Last Updated: December 2025

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Access Control](#user-roles--access-control)
3. [Authentication & Security](#authentication--security)
4. [Assessment & Exam Management](#assessment--exam-management)
5. [Question Bank System](#question-bank-system)
6. [Question Types (14 Supported)](#question-types-14-supported)
7. [Exam Builder & Randomization](#exam-builder--randomization)
8. [Access Code Management](#access-code-management)
9. [Student Exam Interface](#student-exam-interface)
10. [Offline Architecture](#offline-architecture)
11. [Grading & Results](#grading--results)
12. [Student Management](#student-management)
13. [Academic Structure](#academic-structure)
14. [Hall & Allocation System](#hall--allocation-system)
15. [Announcements](#announcements)
16. [Reports & Analytics](#reports--analytics)
17. [System Settings](#system-settings)
18. [API Architecture](#api-architecture)
19. [Database Schema](#database-schema)
20. [Technology Stack](#technology-stack)

---

## System Overview

The CBT System is a comprehensive, offline-capable computer-based testing platform designed for Nigerian schools (JSS and SSS levels). It provides a complete solution for exam creation, delivery, and grading with robust offline support for schools with intermittent internet connectivity.

### Key Highlights

- **🎯 Purpose-Built**: Designed specifically for Nigerian school assessment workflows
- **📱 Offline-First**: Full exam-taking capability without internet connection
- **🔒 Secure**: Session-token protection, tab fencing, cheat detection
- **⚡ Real-time**: Auto-save, sync queue, live monitoring
- **📊 Comprehensive**: From question bank to result analytics
- **🏫 Multi-School**: Support for multiple schools/institutions
- **♿ Accessible**: Responsive design, PWA support

---

## User Roles & Access Control

### Role Hierarchy

#### 1. **Main Admin** (Highest Privileges)
**Page Access (14 pages):**
- Overview Dashboard
- Questions Management
- Exams Management
- Exam Access (Access Codes)
- Students Management
- Results & Grading
- Academic Management (Subjects, Classes, Departments)
- Announcements
- Allocation System (Hall Assignment)
- View Allocations
- Generate Allocation
- Teacher Assignment
- Halls Management
- **System Settings** (Main Admin Only)
- **Activity Logs** (Main Admin Only)

**Capabilities:**
- Create/modify/delete all system resources
- Manage user accounts and roles
- Configure system-wide settings (theme, school name, features)
- View comprehensive activity logs
- Absolute control over all modules

#### 2. **Admin** (School Administrator)
**Page Access (12 pages):**
- All pages except System Settings and Activity Logs
- Overview Dashboard
- Questions Management
- Exams Management
- Exam Access
- Students Management
- Results & Grading
- Academic Management
- Announcements
- Allocation System
- View Allocations
- Generate Allocation
- Teacher Assignment
- Halls Management

**Capabilities:**
- Full CRUD on exams, questions, students
- Access code generation
- Results management and grading
- Hall allocation
- Announcement creation
- Cannot modify system settings or view activity logs

#### 3. **Teacher** (Instructor/Supervisor)
**Page Access (5 pages):**
- Overview Dashboard
- Exams Management (view/monitor only)
- Exam Access (generate codes for their exams)
- Students Management (view student lists)
- Results & Grading (view/mark their exams)

**Capabilities:**
- View exams they supervise
- Generate access codes for their exams
- Monitor student progress during exams
- Grade essay/long-answer questions
- View student results

#### 4. **Student** (Exam Taker)
**Access:**
- Dedicated CBT Interface (separate from admin portal)
- No admin panel access
- Login via registration number + access code

**Capabilities:**
- Take assigned exams
- View results (when released by admin)
- Offline exam taking with auto-sync

### Role-Based Middleware Protection

```
backend/app/Http/Middleware/
├── CheckRole.php (role verification)
├── MainAdminOnly.php (system settings guard)
└── Authenticate.php (Sanctum JWT auth)
```

---

## Authentication & Security

### 1. **Admin/Teacher Authentication**

#### Login Flow
- **Endpoint**: `POST /api/auth/login`
- **Method**: Email + Password
- **Token**: JWT via Laravel Sanctum
- **Session**: Bearer token in Authorization header

#### Two-Factor Authentication (2FA)
- **Google Authenticator**: TOTP-based 6-digit codes
- **Email OTP**: One-time passwords sent via email
- **Recovery Codes**: 10 backup codes generated during 2FA setup
- **Endpoints**:
  - `POST /api/profile/2fa/google/setup` - Generate QR code
  - `POST /api/profile/2fa/google/verify` - Verify TOTP code
  - `POST /api/profile/2fa/email/enable` - Enable email OTP
  - `POST /api/two-factor/recovery-codes` - Generate recovery codes
  - `POST /api/profile/2fa/disable` - Disable 2FA

#### Password Reset
- **Email-Based Flow**:
  - `POST /api/auth/password/forgot` - Send reset link
  - `POST /api/auth/password/reset` - Reset with token
- **OTP-Based Flow** (Alternative):
  - `POST /api/auth/password/otp/request` - Request OTP
  - `POST /api/auth/password/otp/verify` - Reset with OTP

### 2. **Student Authentication**

#### CBT Interface Login
- **Endpoint**: `POST /api/exam-access/verify`
- **Credentials**: Registration Number + Access Code
- **No Password**: Students don't have passwords (security by access code)
- **Session Token**: Returned upon successful verification
- **Offline Support**: Codes cached locally, verified against IndexedDB

#### Session Management
- **Duration**: Tied to exam duration
- **Token Validation**: Every API call validates session token
- **Expiry**: Auto-expires when exam time ends
- **Replacement**: New access code voids previous attempts (admin-controlled)

### 3. **Security Features**

#### Exam Session Protection
- **Tab Fencing**: Detects tab switches/window blur
- **Event Logging**: All suspicious activity logged to `exam_events` table
  - Tab switch
  - Window focus loss
  - Full-screen exit
  - Copy/paste attempts
  - Right-click disable (optional)
- **Cheat Detection**: Admin can review flagged events per attempt

#### API Security
- **Rate Limiting**:
  - Login: `30 requests/minute`
  - Answer submission: `120 requests/minute`
  - Events: `240 requests/minute`
  - Health check: `120 requests/minute`
- **CORS**: Configured for frontend domain only
- **SQL Injection**: Eloquent ORM parameterized queries
- **XSS Protection**: Input sanitization, CSP headers
- **CSRF**: SameSite cookies, token validation

#### Offline Security
- **Code Validation**: Access codes verified locally before exam start
- **Encrypted Storage**: IndexedDB encryption (optional)
- **No Password Storage**: Student credentials never stored locally
- **Sync Queue Integrity**: Signed payloads prevent tampering

---

## Assessment & Exam Management

### 1. **Assessment Types**

The system supports **4 assessment categories** (stored in `exams.assessment_type`):

| Assessment Type | Purpose | Typical Weight | Use Case |
|----------------|---------|----------------|----------|
| **CA Test** | Continuous Assessment | 10-20% | Weekly/monthly tests |
| **Midterm Test** | Mid-semester evaluation | 20-30% | Half-term exams |
| **Final Exam** | End-of-term evaluation | 50-70% | Terminal exams |
| **Quiz** | Quick check | 5-10% | Pop quizzes, practice |

**Note**: `assessment_display_mode` affects **labels only** (e.g., "Exam" vs "CA Test" in UI). The actual question selection algorithm uses `question_selection_mode` (fixed/random), NOT the display mode.

### 2. **Exam Structure**

Each exam is tied to:
- **Single Subject**: One exam tests one subject (`subject_id`)
- **Single Class**: One exam is for one class level (`class_id`)
- **Assessment Type**: CA Test, Midterm, Final Exam, or Quiz
- **Assessment Weight**: Percentage contribution to overall grade (optional)

**Database Fields** (`exams` table):
```sql
- id
- subject_id (FK to subjects)
- class_id (FK to school_classes)
- title
- description
- assessment_type (enum: 'CA Test', 'Midterm Test', 'Final Exam', 'Quiz')
- assessment_weight (1-100, percentage)
- duration (minutes)
- total_marks
- pass_mark
- status (draft, published, closed, archived)
- scheduled_at (exam date/time)
- ends_at (deadline)
- randomize_questions (boolean)
- randomize_options (boolean)
- question_selection_mode ('fixed' or 'random')
- total_questions_to_serve (for random mode)
- questions_locked (boolean, prevents editing after students start)
- show_results_immediately (boolean)
- results_visible (boolean, admin controls release)
- created_by (FK to users)
```

### 3. **Exam Lifecycle**

#### Statuses
1. **Draft**: Exam being created, not visible to students
2. **Published**: Active, students can take it
3. **Closed**: Exam ended, no more attempts allowed
4. **Archived**: Historical, read-only

#### Publishing Workflow
```
Create Exam (Draft)
  ↓ Add Questions
  ↓ Configure Settings
  ↓ Lock Questions (optional)
  ↓ Publish
  ↓ Generate Access Codes
  ↓ Students Take Exam
  ↓ Close Exam
  ↓ Release Results
  ↓ Archive (optional)
```

### 4. **Exam Configuration Options**

#### Timing
- **Duration**: Total time in minutes (countdown timer)
- **Scheduled Start**: Exam availability begins
- **Scheduled End**: Deadline for submissions
- **Grace Period**: Optional extension (configurable)

#### Question Behavior
- **Randomize Questions**: Shuffle question order per student
- **Randomize Options**: Shuffle answer choices (for MCQ/True-False)
- **Skip/Review**: Allow students to flag questions for review
- **Navigation**: Free navigation vs. linear (optional)

#### Results Handling
- **Show Results Immediately**: Auto-display score after submission
- **Results Visible**: Admin toggle to release results to all students
- **Pass Mark**: Minimum score for pass/fail classification

#### Security
- **Tab Fencing**: Detect tab switches (logged as suspicious events)
- **Questions Locked**: Prevent editing after first student starts
- **One Attempt**: Limit students to single submission (default)
- **Session Replacement**: Allow new access code to void old attempts (admin-controlled)

---

## Question Bank System

### Overview

The CBT system uses a **dual storage model** for questions:

1. **Global Question Bank** (`bank_questions` table): Reusable question repository
2. **Exam-Specific Questions** (`exam_questions` table): Standalone or linked to bank

### 1. **Global Question Bank**

#### Purpose
- Centralized repository for all questions
- Reusable across multiple exams
- Version control for question edits
- Workflow: Draft → Pending Review → Active → Inactive → Archived

#### Features
- **Versioning**: Every edit creates new version, previous versions preserved
- **Status Workflow**:
  - **Draft**: Question being created
  - **Pending Review**: Submitted for approval
  - **Active**: Approved, usable in exams
  - **Inactive**: Temporarily disabled
  - **Archived**: Historical, read-only
- **Tags**: Categorize by topic, difficulty, curriculum standard
- **Creator Tracking**: `created_by` field links to user
- **Subject Association**: Questions belong to subjects
- **Statistics**: Usage count, average score, difficulty rating

#### Endpoints
- `GET /api/bank/questions` - List all bank questions
- `GET /api/bank/questions/{id}` - View specific question
- `POST /api/bank/questions` - Create new bank question
- `PUT /api/bank/questions/{id}` - Update (creates new version)
- `POST /api/bank/questions/{id}/duplicate` - Duplicate question
- `POST /api/bank/questions/{id}/submit-for-review` - Submit for approval
- `POST /api/bank/questions/{id}/approve` - Approve question (Admin)
- `POST /api/bank/questions/{id}/archive` - Archive question
- `GET /api/bank/questions/{id}/versions` - List all versions
- `POST /api/bank/questions/{id}/versions/{version}/revert` - Revert to old version
- `POST /api/bank/questions/import` - Bulk import from CSV/JSON
- `GET /api/bank/questions/export` - Export to CSV/JSON

### 2. **Exam Questions**

#### Storage Options

**Option A: Link to Bank Question** (Recommended)
- Question stored in `bank_questions`
- Exam links via `exam_questions` pivot table
- Changes to bank question auto-reflect in exam (unless version locked)
- Per-exam overrides: marks, order

**Option B: Standalone Exam Question**
- Question stored directly in `exam_questions` table
- Independent from global bank
- No reusability across exams
- Useful for one-off questions

#### Linking via `exam_questions` Pivot

**Schema**:
```sql
exam_questions (pivot table):
- id
- exam_id (FK to exams)
- bank_question_id (FK to bank_questions, nullable)
- version_number (lock to specific bank version)
- order_index (display order in exam)
- marks_override (override bank question's default marks)
- created_at
- updated_at
```

**Workflow**:
1. Admin creates exam
2. Admin picks questions from bank
3. System creates `exam_questions` records linking `exam_id` + `bank_question_id`
4. Admin can override marks per exam (e.g., same question worth 2 marks in Quiz, 5 marks in Final Exam)
5. Admin locks questions (`exams.questions_locked = true`)
6. Students take exam → system fetches questions by joining `exam_questions` → `bank_questions`

#### Overrides
- **Marks**: `exam_questions.marks_override` overrides `bank_questions.marks`
- **Order**: `exam_questions.order_index` determines display sequence
- **Version Lock**: `exam_questions.version_number` pins to specific bank version (prevents updates)

### 3. **Question Reordering**

- **Manual Reordering**: Drag-and-drop in exam builder UI
- **Endpoint**: `POST /api/exams/{exam}/questions/reorder`
- **Payload**: Array of `{exam_question_id, order_index}` pairs
- **Locked Check**: Fails if `exams.questions_locked = true`

---

## Question Types (14 Supported)

The system supports **14 comprehensive question types**, covering all common assessment needs:

### 1. **Multiple Choice (Single Answer)**
**Type**: `multiple_choice_single`

**Structure**:
- Question text (supports rich text, images)
- 2-10 answer options
- Exactly 1 correct answer
- Randomize options: Yes (if `exam.randomize_options = true`)

**Grading**: Auto-graded (exact match)

**Example**:
```
Question: What is the capital of Nigeria?
A) Lagos
B) Abuja (✓ Correct)
C) Kano
D) Port Harcourt
```

### 2. **Multiple Choice (Multiple Answers)**
**Type**: `multiple_choice_multiple`

**Structure**:
- Question text
- 2-10 options
- Multiple correct answers (student must select ALL)
- Partial credit: Optional (all-or-nothing vs. per-correct-choice)

**Grading**: Auto-graded (requires all correct selections)

**Example**:
```
Question: Which of the following are prime numbers?
☑ A) 2 (✓)
☐ B) 4
☑ C) 3 (✓)
☑ D) 5 (✓)
☐ E) 9
```

### 3. **True/False**
**Type**: `true_false`

**Structure**:
- Statement
- Two options: True / False
- Single correct answer

**Grading**: Auto-graded

**Example**:
```
Statement: Nigeria gained independence in 1960.
◉ True (✓)
○ False
```

### 4. **Short Answer**
**Type**: `short_answer`

**Structure**:
- Question text
- Text input (1-2 sentences)
- Acceptable answers: List of keywords/phrases
- Case-sensitive: Optional

**Grading**: Auto-graded (keyword matching) or Manual review

**Example**:
```
Question: What is the molecular formula for water?
Answer: ____________
Accepted: "H2O", "H₂O"
```

### 5. **Essay / Long Answer**
**Type**: `essay`

**Structure**:
- Question text (may include passage/context)
- Large text area (unlimited length)
- Word count: Optional min/max
- Rubric: Optional (for grading guidance)

**Grading**: **Manual only** (requires teacher review)

**Example**:
```
Question: Discuss the causes of World War II. (500-800 words)
[Large text area]
```

### 6. **Fill in the Blank**
**Type**: `fill_blank`

**Structure**:
- Sentence with blanks: `The _____ is the largest planet in our solar system.`
- Multiple blanks: Supported
- Acceptable answers: List per blank
- Case-sensitive: Optional

**Grading**: Auto-graded (exact match or keyword)

**Example**:
```
The ___1___ is the largest planet, while ___2___ is the smallest.
Blank 1: "Jupiter"
Blank 2: "Mercury"
```

### 7. **Matching / Pairing**
**Type**: `matching`

**Structure**:
- Two columns: Items (left) and Matches (right)
- Student pairs each item with correct match
- Format: Drag-and-drop or dropdown

**Grading**: Auto-graded (all pairs must be correct)

**Example**:
```
Match the countries with their capitals:
Nigeria     ←→ Abuja
France      ←→ Paris
Japan       ←→ Tokyo
Brazil      ←→ Brasília
```

### 8. **Ordering / Sequencing**
**Type**: `ordering`

**Structure**:
- List of items in scrambled order
- Student arranges in correct sequence
- Format: Drag-and-drop or numbering

**Grading**: Auto-graded (exact sequence required)

**Example**:
```
Arrange the following historical events in chronological order:
___ World War II
___ Nigerian Independence
___ Fall of Berlin Wall
___ COVID-19 Pandemic

Correct order: 1, 2, 3, 4
```

### 9. **Image-Based Question**
**Type**: `image_based`

**Structure**:
- Main image (diagram, chart, photo)
- Question about image
- Answer type: MCQ, short answer, or hotspot click
- Image hotspots: Optional (click regions on image)

**Grading**: Auto-graded (if MCQ) or Manual (if descriptive)

**Example**:
```
[Image: Human heart diagram]
Question: Identify the part labeled 'A'.
Answer: Left Ventricle
```

### 10. **Audio-Based Question**
**Type**: `audio_based`

**Structure**:
- Audio file (MP3, WAV)
- Question about audio (listening comprehension)
- Answer type: MCQ or short answer
- Playback controls: Play, pause, replay limit (optional)

**Grading**: Auto-graded (if MCQ) or Manual

**Example**:
```
[Audio: French conversation]
Question: What did Marie order for lunch?
A) Salad
B) Soup (✓)
C) Sandwich
D) Pizza
```

### 11. **Passage / Comprehension**
**Type**: `passage`

**Structure**:
- Long text passage (article, story, excerpt)
- Multiple sub-questions about passage
- Sub-questions: Any type (MCQ, short answer, essay)

**Grading**: Mixed (auto + manual depending on sub-questions)

**Example**:
```
[Passage: 300-word article about climate change]

1. What is the main cause of global warming mentioned in the passage?
2. According to the text, which country emits the most CO2?
3. Explain the greenhouse effect described in paragraph 3. (Essay)
```

### 12. **Case Study**
**Type**: `case_study`

**Structure**:
- Detailed scenario (business case, medical case, legal case)
- Context, data, background information
- Multiple analysis questions
- May include tables, charts, images

**Grading**: Mixed (auto + manual)

**Example**:
```
[Case Study: XYZ Company Financial Performance 2020-2024]
[Tables showing revenue, profit, expenses]

1. Calculate the net profit margin for 2023.
2. What trend do you observe in operating expenses?
3. Recommend a strategy to improve profitability. (Essay)
```

### 13. **Calculation / Formula**
**Type**: `calculation`

**Structure**:
- Math/science problem requiring calculation
- Formula provided (optional)
- Numeric answer with tolerance range
- Units: Specify (e.g., meters, kg, dollars)

**Grading**: Auto-graded (numeric comparison with tolerance)

**Example**:
```
Question: Calculate the area of a circle with radius 5 cm. (Use π = 3.14)
Answer: _______ cm²
Correct: 78.5 (tolerance ±0.5)
```

### 14. **Practical / Scenario**
**Type**: `practical`

**Structure**:
- Real-world scenario requiring problem-solving
- Step-by-step solution expected
- May include simulations, diagrams, code
- Open-ended or guided steps

**Grading**: **Manual only** (requires subjective evaluation)

**Example**:
```
Scenario: You are a network administrator. A user reports they cannot connect to the internet. How would you troubleshoot this issue? List step-by-step actions.

[Large text area for detailed response]
```

---

## Exam Builder & Randomization

### 1. **Exam Builder Features**

#### Question Management
- **Add Questions**:
  - Pick from global bank
  - Create standalone questions
  - Bulk import from CSV/JSON
- **Edit Questions**: Modify text, options, marks (before locking)
- **Reorder Questions**: Drag-and-drop, manual ordering
- **Delete Questions**: Remove from exam (before locking)
- **Duplicate Questions**: Clone within or across exams
- **Preview**: View question as students will see it

#### Question Locking
- **Purpose**: Prevent editing after first student starts exam
- **Trigger**: Auto-locks when first `exam_attempt` created, or manual lock by admin
- **Status**: `exams.questions_locked = true`
- **Effect**: All question CRUD operations fail with "Questions locked" error
- **Unlock**: Only via `POST /api/exams/{id}/randomization/unlock` (Admin only)

### 2. **Question Selection Modes**

#### Fixed Mode (`question_selection_mode = 'fixed'`)
- **Behavior**: All students see **exact same questions** in **same order**
- **Configuration**:
  - Admin manually selects questions from bank
  - Admin sets `order_index` for each question
  - Optional: Shuffle order per student (if `randomize_questions = true`)
- **Use Case**: Standardized exams, uniform assessment

**Example**:
```
Exam: Mathematics Final Exam (Fixed Mode)
Questions: 1, 5, 8, 12, 15, 20 from bank
All students see: Q1 → Q5 → Q8 → Q12 → Q15 → Q20
```

#### Random Mode (`question_selection_mode = 'random'`)
- **Behavior**: Each student gets **different subset** of questions randomly picked from pool
- **Configuration**:
  - **Total Questions to Serve**: `exams.total_questions_to_serve` (e.g., 20 out of 50 bank questions)
  - **Difficulty Distribution**: Specify how many Easy/Medium/Hard questions
    - Example: 10 Easy, 6 Medium, 4 Hard
  - **Marks Distribution**: Specify marks allocation per difficulty
    - Example: Easy=1 mark, Medium=2 marks, Hard=3 marks
  - **Section-Based**: Optional (pool questions from specific tags/topics)
- **Algorithm**: See [Random Selection Algorithm](#random-selection-algorithm) below
- **Use Case**: Anti-cheating, large question pools, practice exams

**Example**:
```
Exam: Chemistry Quiz (Random Mode)
Bank: 100 questions
Serve: 20 questions per student
Distribution:
  - 10 Easy (1 mark each)
  - 6 Medium (2 marks each)
  - 4 Hard (3 marks each)

Student A sees: Q5, Q12, Q23, ... (20 questions, total 34 marks)
Student B sees: Q7, Q15, Q29, ... (20 different questions, total 34 marks)
```

### 3. **Random Selection Algorithm**

**Implementation**: `CbtInterfaceController::buildQuestionOrder()`

**Steps**:
1. **Fetch All Exam Questions**: Load all questions linked to exam via `exam_questions` join
2. **Filter by Requirements**:
   - If difficulty distribution specified: Group by difficulty level
   - If marks distribution specified: Group by marks value
   - If tags specified: Filter by question tags
3. **Random Sampling**:
   ```php
   // Pseudo-code
   $selectedQuestions = [];
   foreach ($difficultyLevels as $level => $count) {
       $pool = $allQuestions->where('difficulty', $level);
       $picked = $pool->random($count);
       $selectedQuestions = array_merge($selectedQuestions, $picked);
   }
   ```
4. **Shuffle Order** (if `randomize_questions = true`):
   ```php
   shuffle($selectedQuestions);
   ```
5. **Store in Attempt**:
   - Save selected question IDs and order to `exam_attempts.question_order` (JSON array)
   - Example: `[{"id": 5, "order": 1}, {"id": 12, "order": 2}, ...]`
6. **Lock Selection**: Once stored, student always sees same questions in same order (even on refresh)

**Key Points**:
- **Deterministic**: Once selected, student's questions never change
- **Fair**: Same total marks for all students despite different questions
- **Secure**: Question order stored server-side, not exposed to client

### 4. **Difficulty & Marks Distribution**

#### Configuration Options
- **By Difficulty**:
  ```json
  {
    "easy_count": 10,
    "medium_count": 6,
    "hard_count": 4,
    "easy_marks": 1,
    "medium_marks": 2,
    "hard_marks": 3
  }
  ```
- **By Marks**:
  ```json
  {
    "1_mark_count": 15,
    "2_mark_count": 8,
    "3_mark_count": 2
  }
  ```
- **By Topic/Tag**:
  ```json
  {
    "algebra": 8,
    "geometry": 6,
    "calculus": 6
  }
  ```

#### Validation
- **Total Marks Check**: Sum of (count × marks) must match `exams.total_marks`
- **Sufficient Pool**: Each category must have enough questions in bank
- **Preview**: Admin can preview random selection before locking

### 5. **Question Shuffling**

#### Options Shuffling (`randomize_options = true`)
- **Applies To**: MCQ (single/multiple), True/False, Matching
- **Behavior**: Answer choices displayed in random order per student
- **Correct Answer**: Tracked by option ID, not position
- **Example**:
  ```
  Student A sees: A, B, C, D
  Student B sees: C, A, D, B (same options, different order)
  ```

#### Questions Shuffling (`randomize_questions = true`)
- **Applies To**: All question types
- **Behavior**: Question display order randomized per student
- **Fixed Mode**: Shuffle from predefined set
- **Random Mode**: Shuffle after random selection

### 6. **Exam Randomization Endpoints**

- `PUT /api/exams/{id}/randomization` - Configure randomization settings
- `GET /api/exams/{id}/randomization/preview` - Preview random selection
- `POST /api/exams/{id}/randomization/lock` - Lock questions for exam
- `POST /api/exams/{id}/randomization/unlock` - Unlock questions (Admin only)
- `GET /api/exams/{id}/randomization/stats` - View distribution statistics
- `GET /api/exams/{id}/randomization/selection` - Get student's selected questions

---

## Access Code Management

### Overview

Students login to exams using **one-time access codes** (not passwords). Admins generate codes for each exam, and students enter `registration_number + access_code` to start.

### 1. **Access Code Structure**

**Table**: `exam_access`

**Schema**:
```sql
- id
- exam_id (FK to exams)
- access_code (6-8 character alphanumeric, unique)
- student_id (nullable, for assigned codes)
- registration_number (nullable, for assigned codes)
- max_uses (default 1, unlimited if 0)
- used_count (increment on each use)
- expires_at (timestamp)
- is_active (boolean, admin can disable)
- created_at (generation timestamp)
- updated_at
```

### 2. **Code Generation**

#### Bulk Generation
- **Endpoint**: `POST /api/admin/exam-access/generate`
- **Payload**:
  ```json
  {
    "exam_id": 123,
    "quantity": 50,
    "code_length": 6,
    "expiry_minutes": 180,
    "assigned_students": [] // optional, for specific students
  }
  ```
- **Algorithm**: Random secure alphanumeric string (no ambiguous chars: 0/O, 1/I)
- **Duplicate Check**: Ensures uniqueness per exam

#### Individual Code Generation
- **For Specific Student**:
  ```json
  {
    "exam_id": 123,
    "student_id": 456,
    "expiry_minutes": 180
  }
  ```
- **Assigned Code**: Links `exam_access.student_id`, only that student can use it

### 3. **Code Usage Flow**

#### Student Login
1. **Student enters**: `REG123456` + `ABC123` (registration number + access code)
2. **Frontend calls**: `POST /api/exam-access/verify`
   ```json
   {
     "registration_number": "REG123456",
     "access_code": "ABC123",
     "exam_id": 123
   }
   ```
3. **Backend validates**:
   - Access code exists and matches exam
   - Code not expired (`expires_at > now()`)
   - Code not exhausted (`used_count < max_uses` OR `max_uses = 0`)
   - Code is active (`is_active = true`)
   - Registration number matches (if code is assigned)
4. **Backend checks eligibility**:
   - Exam is published and not closed
   - Student hasn't exceeded attempt limit
   - Check session replacement setting (see below)
5. **Success**: Return session token + student_id + exam_id
6. **Increment**: `exam_access.used_count++`

#### Session Replacement Logic

**Problem**: Student took exam in "Exam" window, admin switched to "Test" window and generated new access code. Student tries to login with new code but system blocks: "You already have an attempt for this exam."

**Solution** (Implemented Dec 2025):
- **Compare Timestamps**: When new access code generated AFTER student's latest attempt:
  ```php
  if ($accessCode->created_at > $latestAttempt->created_at) {
      // New code is newer, allow fresh start
      $latestAttempt->status = 'voided';
      $latestAttempt->voided_at = now();
      $latestAttempt->void_reason = 'Session replaced by new access code';
      $latestAttempt->save();
      
      // Create new attempt
      $newAttempt = ExamAttempt::create([...]);
  }
  ```
- **Benefit**: Admin can reset student's exam by generating new code
- **Security**: Only admin can generate codes, prevents student abuse

### 4. **Code Management**

#### Admin Actions
- **List Codes**: `GET /api/admin/exam-access?exam_id={id}`
- **Deactivate Code**: `DELETE /api/admin/exam-access/{id}` (soft delete via `is_active = false`)
- **View Usage**: See `used_count` and associated attempts
- **Export Codes**: CSV download of all codes for an exam

#### Offline Sync
- **Download Codes**: Supervisor downloads all codes for offline exam station
- **Endpoint**: `GET /api/cbt/offline-exams` (returns exams with associated access codes)
- **Local Verification**: Codes cached in IndexedDB, verified client-side when offline
- **Sync Usage**: When back online, sync `used_count` updates to server

### 5. **Code Security**

- **Expiry**: Codes auto-expire after configured duration (default 3 hours from exam start)
- **Use Limit**: Default 1 use per code (can be unlimited for practice exams)
- **Active Flag**: Admin can disable compromised codes
- **No Reuse**: Once student submits exam, code marked as fully used
- **Audit Trail**: All code usage logged in `exam_attempts` table

---

## Student Exam Interface

### 1. **CBT Interface Components**

#### Dedicated Exam Portal
- **Route**: `/cbt/exam-login` (separate from admin portal)
- **Authentication**: Registration number + Access code (no password)
- **Session**: Token-based, expires with exam
- **Offline**: Full offline capability via service worker + IndexedDB

#### Interface Features
- **Clean UI**: Distraction-free exam environment
- **Question Navigator**: Sidebar showing answered/flagged/unanswered status
- **Timer**: Countdown with visual warnings (5 min, 1 min remaining)
- **Auto-Save**: Every answer auto-saved (online: to server, offline: to IndexedDB)
- **Flag for Review**: Mark questions to revisit before submission
- **Progress Bar**: Visual completion indicator
- **Submit Warning**: Confirmation before final submission

### 2. **Exam Taking Flow**

#### Login & Start
1. **Student visits**: `/cbt/exam-login`
2. **Enters credentials**: Reg number + Access code
3. **System verifies**: `POST /api/exam-access/verify`
4. **Success**: Redirect to exam interface with session token
5. **Start exam**: `POST /api/cbt/attempts/{attemptId}/start`
   - Creates `exam_attempt` record
   - Starts timer
   - Loads questions

#### Answer Submission
1. **Student answers question**: Clicks option, types text, etc.
2. **Auto-save triggers**: 2 seconds after last input change
3. **Save answer**: `POST /api/cbt/attempts/{attemptId}/answer`
   ```json
   {
     "question_id": 123,
     "answer_data": {
       "selected_options": [2, 5], // for MCQ
       "text_answer": "H2O",       // for short answer
       "essay_text": "...",         // for essay
       "order": [3, 1, 4, 2]        // for ordering
     }
   }
   ```
4. **Backend saves**: To `exam_answers` table
5. **Offline**: Save to IndexedDB, queue for sync

#### Events & Monitoring
- **Tab Switch**: `POST /api/cbt/attempts/{attemptId}/event`
  ```json
  {
    "event_type": "tab_switch",
    "timestamp": "2025-12-26T10:30:15Z"
  }
  ```
- **Window Blur**: Logged as suspicious event
- **Copy/Paste**: Optionally disabled, logged if attempted
- **Ping**: Regular heartbeat to confirm student still active
  - `POST /api/cbt/attempts/{attemptId}/ping` (every 30 seconds)

#### Exam Submission
1. **Student clicks "Submit"**: Confirmation modal appears
2. **Final check**: "Are you sure? You have 5 unanswered questions"
3. **Confirm**: `POST /api/cbt/attempts/{attemptId}/submit`
4. **Backend**:
   - Marks attempt as `submitted`
   - Auto-grades objective questions (MCQ, True/False, etc.)
   - Calculates total score
   - Queues essay questions for manual grading (if any)
5. **Results**:
   - If `show_results_immediately = true`: Display score instantly
   - If `false`: Show "Results pending, check back later"

### 3. **Question Types Display**

Each question type has custom UI component:

| Type | UI Component | Input Method |
|------|--------------|--------------|
| MCQ Single | Radio buttons | Click |
| MCQ Multiple | Checkboxes | Click multiple |
| True/False | Radio buttons (2 options) | Click |
| Short Answer | Text input | Type |
| Essay | Large textarea | Type (WYSIWYG optional) |
| Fill Blank | Text input per blank | Type |
| Matching | Drag-and-drop or dropdowns | Drag or select |
| Ordering | Drag-and-drop list | Drag to reorder |
| Image-Based | Image + MCQ/text input | Click or type |
| Audio-Based | Audio player + MCQ/text | Listen & click/type |
| Passage | Scrollable passage + sub-questions | Type |
| Case Study | Tabbed data + questions | Type |
| Calculation | Numeric input with units | Type number |
| Practical | Large textarea | Type steps |

### 4. **Navigation & Review**

#### Question Navigator
- **Grid View**: Shows all questions as numbered boxes
- **Status Colors**:
  - **Green**: Answered
  - **Yellow**: Flagged for review
  - **Gray**: Unanswered
- **Click to Jump**: Navigate to any question instantly (if free navigation enabled)

#### Review Mode
- **Flag Button**: Student marks question for later review
- **Review Summary**: Before submit, shows list of flagged questions
- **Return to Flagged**: Click to jump back and answer

### 5. **Timer Behavior**

#### Countdown
- **Format**: MM:SS (e.g., 45:30 for 45 minutes 30 seconds)
- **Visual Warnings**:
  - **Normal**: Green text (>5 min remaining)
  - **Warning**: Yellow text (5-1 min remaining)
  - **Critical**: Red text + alert sound (< 1 min)
- **Auto-Submit**: When timer reaches 0:00, exam auto-submits

#### Grace Period
- **Optional**: Admin can configure grace period (e.g., 5 min)
- **Behavior**: Student can continue answering during grace, but warned "Time expired, submit now"
- **Hard Deadline**: After grace, exam force-submits

### 6. **Offline Exam Taking**

#### Download Exam
- **Pre-Download**: Supervisor downloads exam package before session
- **Endpoint**: `GET /api/exams/{id}/package`
- **Package Contents**:
  ```json
  {
    "exam": {...},
    "questions": [...],
    "options": [...],
    "access_codes": [...],
    "students": [...]
  }
  ```
- **Storage**: Saved to IndexedDB via `offlineDB.examPackages.add(...)`

#### Offline Login
- **Verification**: Student credentials checked against cached access codes
- **Local Attempt**: Create `exam_attempt` record in IndexedDB
- **All Answers**: Saved to IndexedDB `offlineDB.answers` table

#### Offline Submission
- **Submit**: Mark attempt as `submitted` in IndexedDB
- **Queue**: Add to `offlineDB.syncQueue` with type `'submit_attempt'`
- **Wait**: Student sees "Pending sync" message

#### Sync When Online
- **Auto-Detect**: Service worker detects internet connection
- **Sync Service**: Processes sync queue
  ```typescript
  // frontend/src/services/syncService.ts
  async function processSyncQueue() {
    const queue = await offlineDB.syncQueue
      .where('status').equals('PENDING')
      .toArray();
    
    for (const item of queue) {
      if (item.type === 'submit_attempt') {
        await syncAttempt(item.entityId);
      } else if (item.type === 'answer') {
        await syncAnswer(item.payloadRef);
      }
    }
  }
  ```
- **Upload**: POST answers to `/api/sync/attempt`
- **Mark Synced**: Update `syncQueue` item status to `'COMPLETED'`
- **Cleanup**: Delete synced items after 7 days

---

## Offline Architecture

### 1. **Technology Stack**

#### Frontend
- **Dexie.js**: IndexedDB wrapper for local storage
- **Service Worker**: Handles offline requests, caching, background sync
- **PWA Manifest**: Installable app, offline-first

#### Backend
- **Laravel**: API endpoints for sync
- **MySQL**: Persistent storage

### 2. **IndexedDB Schema**

**Database**: `CBTOfflineDB` (Dexie)

**Tables**:
```typescript
// frontend/src/services/offlineDB.ts

offlineDB = new Dexie('CBTOfflineDB');
offlineDB.version(3).stores({
  exams:         'id, subjectId, classId, status, createdAt',
  students:      'id, registrationNumber, classId',
  accessCodes:   'id, examId, accessCode, studentId, expiresAt',
  attempts:      'id, examId, studentId, status, startedAt, submittedAt',
  answers:       '++id, attemptId, questionId, updatedAt',
  syncQueue:     '++id, type, entityId, status, createdAt, lastTriedAt, retryCount, payloadRef',
  examPackages:  'id, examId, downloadedAt',
  cheatLogs:     '++id, attemptId, eventType, timestamp',
  meta:          'key'
});
```

### 3. **Offline Workflows**

#### Supervisor Setup (Before Exam)
1. **Login**: Supervisor logs into admin portal (online)
2. **Download Exam Package**:
   - Navigate to exam
   - Click "Download Offline Package"
   - Endpoint: `GET /api/exams/{id}/package`
   - Package includes:
     - Exam metadata
     - All questions + options
     - Access codes for students
     - Student list (if assigned)
3. **Cache**: Browser caches package in IndexedDB
4. **Go Offline**: Disconnect internet, exam station is ready

#### Student Login (Offline)
1. **Student enters**: Reg number + Access code
2. **Frontend checks**: IndexedDB `offlineDB.accessCodes` table
   ```typescript
   const code = await offlineDB.accessCodes
     .where('accessCode').equals(accessCode)
     .where('examId').equals(examId)
     .first();
   
   if (code && code.registrationNumber === regNumber) {
     // Valid, create offline attempt
     const attemptId = await offlineDB.attempts.add({
       examId,
       studentId: code.studentId,
       status: 'in_progress',
       startedAt: new Date(),
       offlineMode: true
     });
   }
   ```
3. **Load Questions**: Fetch from `offlineDB.exams` and `offlineDB.examPackages`

#### Answering Questions (Offline)
1. **Student answers**: Click, type, etc.
2. **Save to IndexedDB**:
   ```typescript
   await offlineDB.answers.put({
     attemptId,
     questionId,
     answerData: {...},
     updatedAt: new Date()
   });
   ```
3. **UI Feedback**: "Saved locally" badge

#### Submit Exam (Offline)
1. **Student submits**: Click "Submit"
2. **Mark as Submitted**:
   ```typescript
   await offlineDB.attempts.update(attemptId, {
     status: 'submitted',
     submittedAt: new Date(),
     needsSync: true
   });
   ```
3. **Queue for Sync**:
   ```typescript
   await offlineDB.syncQueue.add({
     type: 'submit_attempt',
     entityId: attemptId,
     status: 'PENDING',
     createdAt: new Date(),
     retryCount: 0,
     payloadRef: null
   });
   ```
4. **Show Message**: "Exam submitted offline. Will sync when online."

#### Sync When Online (Automatic)
1. **Service Worker Detects**: `navigator.onLine = true`
2. **Trigger Sync**: Call `syncService.processQueue()`
3. **For Each Queue Item**:
   ```typescript
   async function syncAttempt(attemptId: number) {
     const attempt = await offlineDB.attempts.get(attemptId);
     const answers = await offlineDB.answers
       .where('attemptId').equals(attemptId)
       .toArray();
     
     const payload = {
       exam_id: attempt.examId,
       student_id: attempt.studentId,
       started_at: attempt.startedAt,
       submitted_at: attempt.submittedAt,
       answers: answers.map(a => ({
         question_id: a.questionId,
         answer_data: a.answerData
       }))
     };
     
     const response = await fetch('/api/sync/attempt', {
       method: 'POST',
       body: JSON.stringify(payload)
     });
     
     if (response.ok) {
       // Mark synced
       await offlineDB.syncQueue
         .where('entityId').equals(attemptId)
         .modify({ status: 'COMPLETED', syncedAt: new Date() });
       
       // Optionally delete local data
       await offlineDB.answers
         .where('attemptId').equals(attemptId)
         .delete();
     }
   }
   ```
4. **Retry Logic**: If sync fails, increment `retryCount`, retry with exponential backoff
5. **Max Retries**: After 5 failures, mark as `'FAILED'`, alert supervisor

### 4. **Sync Endpoints**

#### Submit Offline Attempt
- **Endpoint**: `POST /api/sync/attempt`
- **Payload**:
  ```json
  {
    "exam_id": 123,
    "student_id": 456,
    "access_code": "ABC123",
    "started_at": "2025-12-26T09:00:00Z",
    "submitted_at": "2025-12-26T10:30:00Z",
    "answers": [
      {
        "question_id": 1,
        "answer_data": {"selected_options": [2]}
      },
      {
        "question_id": 2,
        "answer_data": {"text_answer": "Mitochondria"}
      }
    ],
    "events": [
      {"event_type": "tab_switch", "timestamp": "2025-12-26T09:15:00Z"}
    ]
  }
  ```
- **Backend**:
  - Creates `exam_attempt` record
  - Saves all answers to `exam_answers`
  - Logs events to `exam_events`
  - Auto-grades objective questions
  - Returns result ID

#### Sync Access Code Usage
- **Endpoint**: `POST /api/sync/code-usage`
- **Payload**:
  ```json
  {
    "access_code": "ABC123",
    "exam_id": 123,
    "used_at": "2025-12-26T09:00:00Z"
  }
  ```
- **Backend**: Increments `exam_access.used_count`

#### Batch Sync
- **Endpoint**: `POST /api/offline/batch-sync`
- **Payload**: Array of multiple attempts
- **Use Case**: Supervisor syncs 50 students' exams at once after exam session

### 5. **Offline Data Management**

#### Storage Limits
- **IndexedDB Quota**: Browser-dependent (~50MB-1GB)
- **Monitoring**: Check `navigator.storage.estimate()` before downloads
- **Cleanup**: Delete synced data older than 7 days

#### Data Expiry
- **Exam Packages**: Expire after exam `ends_at` + 1 day
- **Sync Queue**: Delete completed items after 7 days
- **Access Codes**: Expire per `exam_access.expires_at`

#### Security
- **Encryption**: Optional (can use IndexedDB encryption libraries)
- **No Passwords**: Student credentials never stored locally
- **Code Validation**: Codes verified against cached list, not re-generated

### 6. **Offline Limitations**

- **No Real-Time Updates**: Supervisor can't see live progress during offline session
- **No Server-Side Validation**: Answer validation happens on sync, not immediately
- **Clock Sync**: Rely on device clock, may have timezone issues
- **Storage**: Limited by browser quota, large media files may not fit
- **Manual Grading**: Essay questions require online sync for teacher review

---

## Grading & Results

### 1. **Auto-Grading**

#### Supported Question Types
- Multiple Choice (Single/Multiple)
- True/False
- Short Answer (keyword matching)
- Fill in the Blank (exact match or keyword)
- Matching
- Ordering
- Calculation (numeric comparison with tolerance)
- Image-Based (if MCQ-based)
- Audio-Based (if MCQ-based)

#### Grading Engine
- **Location**: `CbtInterfaceController::submit()` and `MarkingController::scoreQuestion()`
- **Process**:
  1. Fetch correct answers from `exam_questions` or `bank_questions`
  2. Compare student's `answer_data` with correct answers
  3. Award marks:
     - **Exact Match**: Full marks
     - **Partial Match**: Partial marks (for multi-select MCQ, if configured)
     - **No Match**: 0 marks
  4. Save to `exam_answers.score_awarded`
  5. Calculate total: Sum of all `score_awarded`
  6. Save to `exam_attempts.score`

#### Auto-Grading Logic Examples

**MCQ Single**:
```php
if ($studentAnswer['selected_option'] == $correctAnswer['correct_option_id']) {
    $score = $question->marks;
} else {
    $score = 0;
}
```

**MCQ Multiple** (All-or-Nothing):
```php
$correctIds = $correctAnswer['correct_option_ids']; // [2, 5, 7]
$studentIds = $studentAnswer['selected_options'];  // [2, 5, 7]

if (empty(array_diff($correctIds, $studentIds)) && empty(array_diff($studentIds, $correctIds))) {
    $score = $question->marks; // Exact match
} else {
    $score = 0;
}
```

**Short Answer** (Keyword Matching):
```php
$acceptedAnswers = $correctAnswer['accepted_answers']; // ["H2O", "H₂O"]
$studentAnswer = strtolower(trim($studentAnswer['text_answer']));

foreach ($acceptedAnswers as $accepted) {
    if (strtolower($accepted) === $studentAnswer) {
        $score = $question->marks;
        break;
    }
}
```

**Calculation** (Tolerance):
```php
$correctValue = $correctAnswer['numeric_value']; // 78.5
$tolerance = $correctAnswer['tolerance'] ?? 0.5;  // ±0.5
$studentValue = (float) $studentAnswer['numeric_answer'];

if (abs($studentValue - $correctValue) <= $tolerance) {
    $score = $question->marks;
} else {
    $score = 0;
}
```

### 2. **Manual Grading**

#### Question Types Requiring Manual Grading
- Essay / Long Answer
- Practical / Scenario
- Case Study (if open-ended)
- Passage (if includes essay sub-questions)
- Any question with subjective evaluation

#### Grading Workflow
1. **Admin Access**: Navigate to [Marking] module
   - `GET /api/marking/exams` - List exams with pending grading
2. **Select Exam**: View attempts
   - `GET /api/marking/exams/{examId}/attempts` - List all attempts
3. **Review Attempt**: View student's answers
   - `GET /api/marking/attempts/{attemptId}` - Full attempt details
4. **Grade Question**:
   - View question, rubric (if any), student's answer
   - Enter score: 0 to max marks
   - Add feedback (optional)
   - Endpoint: `POST /api/marking/attempts/{attemptId}/questions/{questionId}/score`
     ```json
     {
       "score": 7.5,
       "feedback": "Good analysis, but missing conclusion."
     }
     ```
5. **Finalize Grading**:
   - After all essay questions graded, click "Finalize"
   - Endpoint: `POST /api/marking/attempts/{attemptId}/finalize`
   - Recalculates total score including manually graded questions
   - Updates `exam_attempts.score` and `exam_attempts.grading_status = 'completed'`

#### Grading Status
- **Pending**: Attempt submitted, has essay questions, not yet graded
- **In Progress**: Some questions graded, others pending
- **Completed**: All questions graded, total score finalized

### 3. **Results Release**

#### Admin Control
- **Global Toggle**: `exams.results_visible` (boolean)
  - `true`: All students can view results
  - `false`: Results hidden, students see "Results pending"
- **Endpoint**: `POST /api/exams/{id}/toggle-results`
- **Use Case**: Admin waits until all grading completed before releasing results

#### Individual Release
- **Per Student**: Mark specific `exam_attempts.result_released = true`
- **Use Case**: Release results for students who completed grading, while others still pending

#### Immediate Results
- **Auto-Display**: If `exams.show_results_immediately = true` AND all questions auto-gradable → student sees score right after submission
- **Mixed Grading**: If exam has essay questions, student sees "Partial score: 45/60 (Essay questions pending grading)"

### 4. **Result Viewing**

#### Student View
- **Endpoint**: `GET /api/results/student/{studentId}` (auth required)
- **Display**:
  - Exam title, date taken
  - Score: `45 / 60` (75%)
  - Pass/Fail status (based on `exam.pass_mark`)
  - Per-question breakdown (optional, if `exam.show_question_review = true`):
    - Question text
    - Student's answer
    - Correct answer (if allowed by admin)
    - Marks awarded
  - Feedback (for manually graded questions)

#### Admin View
- **Endpoint**: `GET /api/results/exam/{examId}` (auth required)
- **Display**:
  - All students' scores
  - Statistics: Average, highest, lowest, pass rate
  - Per-question analysis: Most missed questions, average score per question
  - Filter by class, student, score range

### 5. **Result Analytics**

#### Exam Performance Metrics
- **Endpoint**: `GET /api/analytics/performance`
- **Metrics**:
  - **Average Score**: Mean score across all attempts
  - **Median Score**: Middle value
  - **Standard Deviation**: Score spread
  - **Pass Rate**: Percentage of students scoring above pass mark
  - **Score Distribution**: Histogram (0-20%, 20-40%, ..., 80-100%)

#### Question Analytics
- **Endpoint**: `GET /api/questions/statistics/exam/{examId}`
- **Metrics Per Question**:
  - **Average Score**: Mean marks awarded
  - **Difficulty**: Percentage who answered correctly (lower = harder)
  - **Discrimination**: How well question differentiates strong/weak students
  - **Most Selected Answer**: For MCQ, which option chosen most

#### Student Performance Trends
- **Endpoint**: `GET /api/analytics/student/{studentId}/dashboard`
- **Metrics**:
  - **Overall Average**: Across all exams
  - **Subject Breakdown**: Performance per subject
  - **Assessment Type Breakdown**: CA vs. Midterm vs. Final Exam
  - **Trend**: Improving, declining, stable (over time)

---

## Student Management

### 1. **Student Records**

**Table**: `students`

**Schema**:
```sql
- id
- registration_number (unique, auto-generated: STU-YYYYMMDD-XXXX)
- first_name
- last_name
- middle_name (nullable)
- date_of_birth
- gender (enum: Male, Female, Other)
- email (nullable)
- phone (nullable)
- class_id (FK to school_classes)
- department_id (FK to departments, nullable for JSS)
- admission_date
- status (enum: Active, Suspended, Graduated, Withdrawn)
- created_at
- updated_at
```

### 2. **Student Registration**

#### Manual Entry
- **Endpoint**: `POST /api/students`
- **Form Fields**:
  - First name, last name, middle name
  - Date of birth, gender
  - Class, department (if SSS)
  - Contact: email, phone
- **Auto-Generate**: `registration_number` → `STU-20251226-1234`

#### Bulk Import (CSV)
- **Endpoint**: `POST /api/students/import`
- **Template Download**: `GET /api/students/import/template`
- **CSV Format**:
  ```csv
  first_name,last_name,middle_name,date_of_birth,gender,class_name,department_name,email,phone
  John,Doe,Smith,2008-05-15,Male,JSS 1,,john@example.com,08012345678
  Jane,Roe,,2007-08-20,Female,SSS 2,Science,jane@example.com,08087654321
  ```
- **Validation**:
  - Required: first_name, last_name, date_of_birth, gender, class_name
  - Duplicate check: email, phone (if provided)
  - Class/department lookup: Match by name
- **Error Handling**: Returns list of failed rows with reasons

#### Export Students
- **Endpoint**: `GET /api/students/export`
- **Format**: CSV with all student records
- **Use Case**: Backup, transfer to other systems

### 3. **Student Profile**

#### View Profile
- **Endpoint**: `GET /api/students/{id}` (Admin) or `GET /api/student/me` (Current student)
- **Data**:
  - Personal info
  - Class, department, subjects assigned
  - Exam history
  - Results summary
  - Attendance (if module exists)

#### Update Profile
- **Endpoint**: `PUT /api/students/{id}` (Admin only)
- **Editable**:
  - Name, contact, class, department, status
- **Restricted**: Registration number (immutable)

### 4. **Subject Assignment**

#### Teacher Subject Selection
- **First Login**: Modal prompts teacher to select subjects they teach
- **Endpoint**: `POST /api/preferences/teacher/subjects`
- **Payload**:
  ```json
  {
    "subject_ids": [1, 5, 8, 12]
  }
  ```
- **Storage**: `user_subjects` pivot table (user_id + subject_id)

#### Student Subject Selection
- **First Login**: Modal prompts student to select subjects (based on class + department)
- **Endpoint**: `POST /api/preferences/student/subjects`
- **Payload**:
  ```json
  {
    "class_id": 3,
    "department_id": 2,
    "subject_ids": [1, 2, 3, 4, 5, 6, 7, 8, 9]
  }
  ```
- **Validation**:
  - Compulsory subjects auto-included
  - Optional subjects: Student chooses from available list
  - Electives: Max 3 (configurable)

#### Dynamic Subject Assignment
- **Rule Engine**:
  - JSS students: All subjects compulsory (Math, English, Science, etc.)
  - SSS students: Core subjects + department-specific + electives
    - **Science**: Physics, Chemistry, Biology, Further Math
    - **Commercial**: Economics, Accounting, Commerce
    - **Arts**: Literature, Government, CRS/IRS
  - **Trade Subjects**: Specialized courses (e.g., Catering, Carpentry, Fashion Design)

### 5. **Student Statistics**

- **Endpoint**: `GET /api/students/{id}/statistics`
- **Metrics**:
  - Total exams taken
  - Average score
  - Pass rate
  - Subjects enrolled
  - Pending exams

---

## Academic Structure

### 1. **School Classes**

**Table**: `school_classes`

**Schema**:
```sql
- id
- name (JSS 1, JSS 2, JSS 3, SSS 1, SSS 2, SSS 3)
- level (enum: JSS, SSS)
- description
- created_at
- updated_at
```

**Endpoints**:
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create class
- `PUT /api/classes/{id}` - Update class
- `DELETE /api/classes/{id}` - Delete class (cascade check)

### 2. **Subjects**

**Table**: `subjects`

**Schema**:
```sql
- id
- name (Mathematics, English Language, Physics, etc.)
- code (MATH, ENG, PHY, etc.)
- description
- is_compulsory (boolean, true for core subjects)
- class_level (enum: JSS, SSS, Both)
- department_id (FK, nullable for core subjects)
- created_at
- updated_at
```

**Subject Types**:
- **Core Subjects** (Compulsory for all):
  - Mathematics, English Language, Civic Education, etc.
- **Science Subjects**:
  - Physics, Chemistry, Biology, Agricultural Science, Further Mathematics
- **Commercial Subjects**:
  - Economics, Accounting, Commerce, Office Practice
- **Arts Subjects**:
  - Literature in English, Government, CRS, IRS, History
- **Vocational/Trade Subjects**:
  - Computer Studies, Technical Drawing, Home Economics, etc.

**Endpoints**:
- `GET /api/subjects` - List all subjects
- `POST /api/subjects` - Create subject
- `PUT /api/subjects/{id}` - Update subject
- `DELETE /api/subjects/{id}` - Delete subject
- `POST /api/subjects/bulk-upload` - Bulk import subjects
- `GET /api/preferences/subjects/class/{classId}` - Get subjects for class

### 3. **Departments**

**Table**: `departments` (SSS only)

**Schema**:
```sql
- id
- name (Science, Commercial, Arts)
- description
- available_for_class (JSS, SSS, Both)
- created_at
- updated_at
```

**Departments**:
1. **Science**: Physics, Chemistry, Biology, Further Math
2. **Commercial**: Economics, Accounting, Commerce
3. **Arts**: Literature, Government, History, CRS/IRS

**Endpoints**:
- `GET /api/departments` - List all departments
- `POST /api/departments` - Create department
- `PUT /api/departments/{id}` - Update department
- `DELETE /api/departments/{id}` - Delete department

### 4. **Subject-Class-Department Relationships**

**Assignment Rules**:
1. **JSS Students**:
   - No department selection
   - All subjects compulsory
   - ~12-15 subjects

2. **SSS Students**:
   - Choose department (Science/Commercial/Arts)
   - Core subjects (6-8) compulsory
   - Department subjects (3-5) compulsory
   - Electives (2-3) optional

**Database Relationships**:
```sql
subjects:
  - class_level: 'JSS', 'SSS', or 'Both'
  - department_id: NULL (for core), or FK (for dept-specific)

students:
  - class_id: FK to school_classes
  - department_id: FK to departments (NULL for JSS)

user_subjects (pivot):
  - user_id (student or teacher)
  - subject_id
```

---

## Hall & Allocation System

### 1. **Hall Management**

**Table**: `halls`

**Schema**:
```sql
- id
- name (Computer Lab A, Main Hall, etc.)
- capacity (number of seats)
- location (building/floor)
- grid_rows (for seating layout, e.g., 10)
- grid_columns (e.g., 8, total = 80 seats)
- status (enum: Active, Maintenance, Inactive)
- created_at
- updated_at
```

**Features**:
- **CRUD Operations**:
  - `GET /api/halls` - List halls
  - `POST /api/halls` - Create hall
  - `PUT /api/halls/{id}` - Update hall
  - `DELETE /api/halls/{id}` - Delete hall
- **Capacity Management**: Define max students per hall
- **Grid Layout**: Visual seating arrangement (rows × columns)
- **Status**: Active halls available for allocation

### 2. **Allocation Engine**

**Purpose**: Assign students to halls and seats for exam sessions, preventing overcrowding and ensuring supervised seating.

**Table**: `allocations`

**Schema**:
```sql
- id
- exam_id (FK to exams)
- run_number (allocation iteration, e.g., Run 1, Run 2)
- status (enum: Draft, Confirmed, Archived)
- total_students
- total_halls
- created_by (FK to users)
- created_at
- updated_at
```

**Table**: `allocation_details`

**Schema**:
```sql
- id
- allocation_id (FK to allocations)
- student_id (FK to students)
- hall_id (FK to halls)
- seat_number (e.g., A-01, B-12)
- row (grid row index)
- column (grid column index)
```

### 3. **Allocation Generation**

#### Automatic Allocation
- **Endpoint**: `POST /api/allocations/generate`
- **Payload**:
  ```json
  {
    "exam_id": 123,
    "strategy": "balanced", // or "fill_hall", "randomized"
    "hall_ids": [1, 2, 3],   // optional, use specific halls
    "spacing": "alternate"   // skip rows/columns for distancing
  }
  ```
- **Algorithm**:
  1. Fetch all students eligible for exam (by class/subject)
  2. Fetch available halls (status = Active, capacity > 0)
  3. Sort students (by reg_number, name, or random)
  4. **Balanced Strategy**: Distribute evenly across halls
     ```
     Hall A (capacity 80): 40 students
     Hall B (capacity 60): 30 students
     Hall C (capacity 40): 20 students
     Total: 90 students across 3 halls
     ```
  5. **Fill Hall Strategy**: Fill Hall A first, then Hall B, etc.
  6. **Spacing**: If alternate seating, skip every other row/column
  7. Assign seat numbers: `A-01, A-02, ..., B-01, B-02`
  8. Save to `allocation_details`

#### Manual Allocation
- **Admin UI**: Drag-and-drop students to halls/seats
- **Endpoint**: `POST /api/allocations/reassign`
- **Payload**:
  ```json
  {
    "allocation_id": 456,
    "student_id": 789,
    "hall_id": 2,
    "seat_number": "B-15"
  }
  ```

### 4. **Allocation Conflicts**

**Detection**:
- **Endpoint**: `GET /api/allocations/conflicts/{runId}`
- **Conflicts**:
  - **Overcapacity**: More students than hall capacity
  - **Duplicate Seat**: Two students assigned same seat
  - **Student Schedule Clash**: Student has overlapping exams

**Resolution**:
- **Regenerate**: Delete and re-run allocation
- **Manual Fix**: Reassign conflicting students

### 5. **Allocation Viewing**

#### Admin View
- **Endpoint**: `GET /api/allocations/exam/{examId}`
- **Display**:
  - List of all runs (Run 1, Run 2, etc.)
  - Per-run: Total students, halls, status
  - **Detailed View**: `GET /api/allocations/run/{id}`
    - Hall-by-hall breakdown
    - Seating chart (visual grid)
    - Filter/search students

#### Student View
- **Endpoint**: `GET /api/allocations/student/{examId}/{studentId}`
- **Display**:
  - Exam title, date
  - Assigned hall and seat number
  - Seating map (highlight student's seat)

### 6. **Allocation Export**

- **PDF Export**: `GET /api/allocations/export/pdf/{runId}`
  - Printable hall lists with student names + seats
  - Use case: Hand to supervisors
- **Excel Export**: `GET /api/allocations/export/excel/{runId}`
  - Spreadsheet with hall, seat, student details

### 7. **Teacher Assignment to Halls**

**Table**: `hall_supervisors`

**Schema**:
```sql
- id
- hall_id (FK to halls)
- user_id (FK to users, teacher role)
- exam_id (FK to exams, nullable for permanent assignment)
- created_at
```

**Workflow**:
1. Admin assigns teachers to halls for specific exam
2. **Endpoint**: `POST /api/halls/{id}/assign-teachers`
   ```json
   {
     "teacher_ids": [10, 15, 22],
     "exam_id": 123
   }
   ```
3. Teachers see assigned halls in their dashboard
4. Teachers can monitor students in their halls during exam

---

## Announcements

### 1. **Announcement Management**

**Table**: `announcements`

**Schema**:
```sql
- id
- title
- content (rich text)
- target_audience (enum: All, Students, Teachers, Specific Class, Specific Department)
- priority (enum: Normal, High, Urgent)
- status (enum: Draft, Published, Archived)
- published_at (timestamp)
- expires_at (timestamp, nullable)
- class_id (FK, nullable, if target = Specific Class)
- department_id (FK, nullable, if target = Specific Department)
- created_by (FK to users)
- created_at
- updated_at
```

### 2. **CRUD Operations**

- **Create**: `POST /api/admin/announcements`
  ```json
  {
    "title": "Exam Timetable Released",
    "content": "The exam timetable for JSS 3 Midterm is now available...",
    "target_audience": "Specific Class",
    "class_id": 3,
    "priority": "High",
    "status": "Published",
    "expires_at": "2025-12-31T23:59:59Z"
  }
  ```
- **List (Admin)**: `GET /api/admin/announcements` (all statuses)
- **List (Public)**: `GET /api/announcements` (published only)
- **Update**: `PUT /api/admin/announcements/{id}`
- **Delete**: `DELETE /api/admin/announcements/{id}`

### 3. **Visibility Rules**

- **All**: Visible to everyone
- **Students**: Visible to all students
- **Teachers**: Visible to all teachers/admins
- **Specific Class**: Visible to students in that class
- **Specific Department**: Visible to students in that department (SSS only)

### 4. **Display**

#### Student Dashboard
- **Widget**: "Announcements" card showing 3 latest
- **Filter**: Only announcements targeting student's class/department/all
- **Priority Highlight**: Urgent announcements shown first with red badge

#### Admin Dashboard
- **Management Page**: Full CRUD interface
- **Preview**: See announcement as students will see it

---

## Reports & Analytics

### 1. **Admin Dashboard Statistics**

**Endpoint**: `GET /api/analytics/admin/dashboard`

**Metrics**:
- **Overview**:
  - Total students
  - Total exams (published/closed)
  - Ongoing exams (currently taking)
  - Pending grading (attempts with essay questions)
- **Recent Activity**:
  - Last 10 exam attempts
  - Last 10 student registrations
  - Last 10 results released
- **Performance**:
  - Overall pass rate (last 30 days)
  - Average exam score (last 30 days)
  - Most challenging exams (lowest avg score)

### 2. **Student Dashboard Statistics**

**Endpoint**: `GET /api/analytics/student/{studentId}/dashboard`

**Metrics**:
- **Personal Stats**:
  - Total exams taken
  - Average score
  - Pass rate
  - Rank in class (optional)
- **Subject Breakdown**:
  - Per-subject average score
  - Strongest/weakest subjects
- **Upcoming Exams**:
  - List of assigned exams with dates

### 3. **Exam Reports**

#### Exam Summary Report
- **Endpoint**: `GET /api/reports/exam/{examId}/pdf`
- **Contents**:
  - Exam title, date, duration
  - Total students, completed/pending
  - Average score, pass rate
  - Score distribution (histogram)
  - Per-question analysis:
    - Question text
    - Average score
    - % correct
    - Most selected answer (for MCQ)

#### Student Result Report
- **Endpoint**: `GET /api/reports/student/{studentId}/pdf`
- **Contents**:
  - Student name, reg number, class
  - List of all exams taken with scores
  - Subject-wise breakdown
  - Graphical performance trends

#### Attempt Detail Report
- **Endpoint**: `GET /api/reports/attempt/{attemptId}/pdf`
- **Contents**:
  - Student + exam info
  - Start/end time, duration
  - Question-by-question breakdown:
    - Question text
    - Student answer
    - Correct answer
    - Marks awarded
  - Total score, pass/fail
  - Feedback (if any)

### 4. **Export Formats**

- **PDF**: Printable, styled reports
- **Excel**: `.xlsx` spreadsheets for data analysis
- **CSV**: Raw data for import into other systems

### 5. **Performance Metrics**

#### Exam Comparison
- **Endpoint**: `POST /api/analytics/exam/comparison`
- **Payload**:
  ```json
  {
    "exam_ids": [123, 124, 125]
  }
  ```
- **Output**:
  - Side-by-side comparison of average scores, pass rates
  - Trends over time (if exams are sequential)

#### Department Performance
- **Endpoint**: `GET /api/analytics/department/performance`
- **Output**:
  - Average scores per department (Science, Commercial, Arts)
  - Pass rates per department
  - Subject-wise performance within departments

---

## System Settings

### 1. **System Settings Management**

**Table**: `system_settings`

**Schema**:
```sql
- id
- key (unique, e.g., 'school_name', 'theme_color', 'allow_registration')
- value (text, JSON, or boolean)
- type (enum: text, number, boolean, json)
- description
- updated_by (FK to users)
- updated_at
```

### 2. **Configurable Settings**

**Access**: Main Admin Only (`middleware: main.admin`)

**Categories**:

#### School Information
- **School Name**: Text (displayed in header, reports)
- **School Logo**: URL or file upload
- **Contact Email**: Text
- **Contact Phone**: Text
- **Address**: Text

#### Theme Customization
- **Primary Color**: Hex code (e.g., #3B82F6)
- **Secondary Color**: Hex code
- **Dark Mode**: Boolean (enable/disable)

#### Feature Toggles
- **Allow Student Registration**: Boolean (open/close registration window)
- **Enable Offline Mode**: Boolean (allow offline exam packages)
- **Enable Two-Factor Auth**: Boolean (require 2FA for admins)
- **Show Results Immediately**: Boolean (default for new exams)

#### Exam Defaults
- **Default Exam Duration**: Number (minutes)
- **Default Pass Mark**: Number (percentage)
- **Default Grace Period**: Number (minutes)
- **Tab Fencing Enabled**: Boolean (default)

#### Email Configuration
- **SMTP Host**: Text
- **SMTP Port**: Number
- **SMTP User**: Text
- **SMTP Password**: Password (encrypted)
- **Email From Address**: Text

#### Activity Logging
- **Log Retention Days**: Number (auto-delete logs older than X days)
- **Log Detail Level**: Enum (Minimal, Standard, Detailed)

### 3. **Settings Endpoints**

- **List All**: `GET /api/settings` (Main Admin only)
- **Update Single**: `PUT /api/settings/{key}`
  ```json
  {
    "value": "New Value"
  }
  ```
- **Bulk Update**: `PUT /api/settings/bulk`
  ```json
  {
    "settings": [
      {"key": "school_name", "value": "ABC Secondary School"},
      {"key": "theme_color", "value": "#3B82F6"},
      {"key": "allow_registration", "value": true}
    ]
  }
  ```

### 4. **Public Settings Endpoint**

- **Endpoint**: `PUT /api/settings/theme` (No auth required, for testing)
- **Use Case**: Demo/preview theme changes before saving
- **Production**: Should be auth-protected

---

## API Architecture

### 1. **Base URL**

- **Production**: `https://yourdomain.com/api`
- **Development**: `http://localhost:8000/api`

### 2. **Authentication**

#### Admin/Teacher:
- **Method**: Laravel Sanctum (JWT tokens)
- **Header**: `Authorization: Bearer {token}`
- **Login**: `POST /api/auth/login`
- **Logout**: `POST /api/auth/logout` (invalidates token)

#### Student (CBT):
- **Method**: Session token (returned on access code verification)
- **Header**: `X-Session-Token: {token}` or `Authorization: Bearer {token}`
- **Expiry**: Token expires with exam duration

### 3. **Rate Limiting**

Configured per route group:

- **Public APIs**: 60 requests/minute
- **Authentication**: 30 requests/minute (login/register)
- **Answer Submission**: 120 requests/minute
- **Event Logging**: 240 requests/minute
- **Admin CRUD**: 600 requests/minute (role management)

### 4. **Response Format**

**Success**:
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

**Error**:
```json
{
  "success": false,
  "error": "Error message",
  "errors": {...}, // validation errors
  "code": 400
}
```

### 5. **HTTP Status Codes**

- **200 OK**: Success
- **201 Created**: Resource created
- **400 Bad Request**: Validation error
- **401 Unauthorized**: Auth required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation failed
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### 6. **Pagination**

**Request**:
```
GET /api/students?page=2&per_page=20
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "current_page": 2,
    "per_page": 20,
    "total": 150,
    "last_page": 8,
    "next_page_url": "/api/students?page=3",
    "prev_page_url": "/api/students?page=1"
  }
}
```

### 7. **Filtering & Sorting**

**Request**:
```
GET /api/exams?status=published&subject_id=5&sort_by=scheduled_at&sort_order=desc
```

**Common Filters**:
- `status`: draft, published, closed, archived
- `subject_id`, `class_id`, `department_id`
- `search`: Text search in title/description
- `date_from`, `date_to`: Date range filters

### 8. **API Endpoint Summary**

**Total Endpoints**: ~150+

**Categories**:
- **Auth**: 8 endpoints (login, logout, password reset, 2FA)
- **Students**: 12 endpoints (CRUD, import, export, statistics)
- **Exams**: 18 endpoints (CRUD, access, statistics, duplication)
- **Questions**: 25 endpoints (CRUD, bulk, import, export, types)
- **Bank Questions**: 20 endpoints (CRUD, versions, approval workflow)
- **Exam Access**: 5 endpoints (generate, verify, list, delete)
- **CBT Interface**: 10 endpoints (verify, start, questions, answer, submit, events)
- **Results**: 8 endpoints (view, analytics, release)
- **Subjects**: 8 endpoints (CRUD, bulk upload, assignment)
- **Departments**: 6 endpoints (CRUD, bulk upload)
- **Classes**: 6 endpoints (CRUD, bulk upload)
- **Halls**: 7 endpoints (CRUD, grid layout, supervisor assignment)
- **Allocations**: 10 endpoints (generate, view, export, conflicts)
- **Announcements**: 5 endpoints (CRUD, publish)
- **Reports**: 6 endpoints (PDF, Excel exports)
- **Analytics**: 6 endpoints (dashboard, performance, trends)
- **Settings**: 4 endpoints (list, update, bulk update)
- **Profile**: 8 endpoints (view, update, picture, password, 2FA)
- **Roles**: 10 endpoints (list, assign, create, update, delete)
- **Activity Logs**: 3 endpoints (list, stats, cleanup)
- **Offline Sync**: 5 endpoints (sync attempt, batch sync, code usage)

### 9. **Middleware Stack**

```php
// backend/routes/api.php

// Public routes (no auth)
Route::post('/auth/login', ...);
Route::post('/exam-access/verify', ...);
Route::get('/cbt/config', ...);

// Authenticated routes (Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // All roles
    Route::get('/profile', ...);
    
    // Role-specific
    Route::middleware('role:Admin|Main Admin')->group(function () {
        Route::post('/exams', ...);
        Route::post('/exam-access/generate', ...);
    });
    
    // Main Admin only
    Route::middleware('main.admin')->group(function () {
        Route::get('/settings', ...);
        Route::get('/activity-logs', ...);
    });
});

// CBT routes (session-token protected)
Route::prefix('cbt')->group(function () {
    Route::post('/attempts/{id}/answer', ...)->middleware('throttle:120,1');
});
```

---

## Database Schema

### 1. **Schema Overview**

**Total Tables**: ~40+

**Categories**:
- **Users & Auth**: users, roles, role_user, password_resets, personal_access_tokens
- **Students**: students, student_subjects
- **Academic**: school_classes, departments, subjects
- **Exams**: exams, exam_questions, exam_access, exam_attempts, exam_answers, exam_events
- **Questions**: questions (exam_questions table), question_options, bank_questions, bank_question_options, bank_question_versions, bank_question_tags
- **Allocations**: halls, allocations, allocation_details, hall_supervisors
- **System**: system_settings, activity_logs, announcements, notifications
- **Offline**: exam_packages (metadata), sync_queue (client-side IndexedDB only)

### 2. **Key Relationships**

```
users (admin/teacher)
  ├─ 1:N → exams (created_by)
  ├─ 1:N → bank_questions (created_by)
  ├─ N:M → roles (via role_user)
  └─ N:M → subjects (via user_subjects, for teachers)

students
  ├─ N:1 → school_classes (class_id)
  ├─ N:1 → departments (department_id, nullable)
  ├─ 1:N → exam_attempts
  └─ N:M → subjects (via student_subjects)

exams
  ├─ N:1 → subjects (subject_id)
  ├─ N:1 → school_classes (class_id)
  ├─ 1:N → exam_access (access codes)
  ├─ 1:N → exam_attempts
  ├─ N:M → bank_questions (via exam_questions pivot)
  └─ 1:N → allocations

bank_questions (global bank)
  ├─ 1:N → bank_question_options
  ├─ 1:N → bank_question_versions (version history)
  ├─ N:M → bank_question_tags
  └─ N:M → exams (via exam_questions pivot)

exam_attempts
  ├─ N:1 → exams
  ├─ N:1 → students
  ├─ 1:N → exam_answers
  └─ 1:N → exam_events (cheat logs)

exam_questions (pivot, can also be standalone)
  ├─ N:1 → exams
  ├─ N:1 → bank_questions (nullable, if linked)
  └─ 1:N → question_options (if standalone)
```

### 3. **Critical Fields**

**exams table**:
- `question_selection_mode`: 'fixed' or 'random' (determines selection algorithm)
- `questions_locked`: Boolean (prevents editing after students start)
- `results_visible`: Boolean (admin controls result release)
- `assessment_type`: 'CA Test', 'Midterm Test', 'Final Exam', 'Quiz'

**exam_attempts table**:
- `question_order`: JSON array (stores selected questions for random mode)
- `status`: 'in_progress', 'submitted', 'graded', 'voided'
- `grading_status`: 'pending', 'in_progress', 'completed'

**exam_answers table**:
- `answer_data`: JSON (flexible schema per question type)
- `score_awarded`: Decimal (auto or manual)
- `is_correct`: Boolean (for objective questions)

**bank_questions table**:
- `version`: Integer (increments on edit)
- `status`: 'Draft', 'Pending Review', 'Active', 'Inactive', 'Archived'
- `question_data`: JSON (stores question-specific fields)

### 4. **Indexes**

- **Primary Keys**: All tables have `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`
- **Foreign Keys**: All relationships indexed (exam_id, student_id, etc.)
- **Unique Constraints**:
  - `students.registration_number`
  - `exam_access.access_code` (per exam)
  - `users.email`
- **Composite Indexes**:
  - `(exam_id, student_id)` on exam_attempts (fast lookup)
  - `(exam_id, bank_question_id)` on exam_questions (prevent duplicates)
  - `(assessment_type, status)` on exams (filtered queries)

---

## Technology Stack

### 1. **Backend**

- **Framework**: Laravel 9+ (PHP 8.1+)
- **Database**: MySQL 8.0+
- **ORM**: Eloquent (with query builder)
- **Authentication**: Laravel Sanctum (token-based JWT)
- **API**: RESTful architecture
- **Middleware**: Auth, Role-based access, Rate limiting
- **Jobs**: Queue system for email, exports, sync (optional)
- **Storage**: Local/S3 for file uploads (images, audio, CSV)

### 2. **Frontend**

- **Framework**: React 18+ (TypeScript)
- **Build Tool**: Vite (fast dev server, HMR)
- **Routing**: React Router v6
- **State Management**: React Context API (or Zustand, optional)
- **Styling**: Tailwind CSS (utility-first)
- **UI Components**: Custom components + Headless UI
- **API Client**: Axios (with interceptors for auth)
- **Offline**: Dexie.js (IndexedDB wrapper), Service Worker
- **PWA**: Workbox (caching strategies, background sync)

### 3. **Database**

- **RDBMS**: MySQL 8.0
- **Migrations**: Laravel migrations (version-controlled schema)
- **Seeders**: Sample data for testing
- **Backup**: Daily automated backups (configurable)

### 4. **Development Tools**

- **IDE**: VS Code (recommended extensions: PHP Intelephense, ESLint, Prettier)
- **Version Control**: Git
- **API Testing**: Postman, Thunder Client (VS Code extension)
- **Linting**: ESLint (frontend), PHP CS Fixer (backend)
- **Formatting**: Prettier (frontend), PSR-12 (backend)

### 5. **Deployment**

- **Server**: Apache/Nginx with PHP-FPM
- **Hosting**: VPS, Shared Hosting, or Cloud (AWS, DigitalOcean, etc.)
- **Domain**: HTTPS required (Let's Encrypt SSL)
- **Process Manager**: Supervisor (for Laravel queues, optional)
- **CDN**: Optional (for static assets, images)

### 6. **Security**

- **HTTPS**: SSL certificate (mandatory for production)
- **CORS**: Configured for frontend domain
- **CSRF**: SameSite cookies, token validation
- **SQL Injection**: Eloquent ORM parameterized queries
- **XSS**: Input sanitization, CSP headers
- **Rate Limiting**: Throttle middleware per route
- **2FA**: Google Authenticator (TOTP), Email OTP

### 7. **Performance**

- **Caching**: Redis/Memcached (optional, for session, query cache)
- **Lazy Loading**: Frontend code splitting (React.lazy)
- **Image Optimization**: Compress uploads, lazy load images
- **Database Indexing**: Optimized for common queries
- **CDN**: Serve static assets from CDN (optional)

---

## Conclusion

This CBT System is a **feature-complete, production-ready assessment platform** designed to meet the needs of Nigerian secondary schools. It combines:

- **Flexibility**: 4 assessment types, 14 question types, fixed/random selection
- **Robustness**: Role-based access, comprehensive security, offline support
- **Usability**: Intuitive UI for admins, teachers, and students
- **Scalability**: Multi-school support, bulk operations, efficient database design

**Key Strengths**:
1. **Offline-First**: Full exam-taking capability without internet
2. **Question Bank**: Reusable question repository with versioning
3. **Randomization**: Anti-cheating with random question selection and shuffling
4. **Dual Storage**: Exam questions can link to bank or be standalone
5. **Session Replacement**: Admins can reset student attempts with new access codes
6. **Manual + Auto Grading**: Supports objective and subjective assessments
7. **Hall Allocation**: Visual seating arrangement with teacher assignment
8. **Comprehensive Reporting**: PDF/Excel exports, analytics, performance metrics
9. **Role-Based Access**: Main Admin, Admin, Teacher, Student with page-level permissions
10. **Modern Tech Stack**: Laravel + React + TypeScript + Tailwind CSS

---

**Documentation Version**: 2.0  
**Last Updated**: December 26, 2025  
**Maintained By**: Development Team  
**Questions?**: Refer to individual module documentation in `/docs` folder.
