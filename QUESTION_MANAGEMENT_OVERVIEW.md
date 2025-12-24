# Question Management Module - Complete Overview

## 🎯 Module Purpose
The Question Management module is a **professional question bank system** that allows admins to create, organize, filter, and manage exam questions. It supports complete lifecycle management from creation to archival, with full database integration and audit trails.

---

## 📊 Table Structure & Columns

### Column Breakdown

| Column | Purpose | Data Source | Used For |
|--------|---------|-------------|----------|
| **Checkbox** | Multi-select questions for bulk actions | Frontend state | Batch export, delete, status change |
| **QID** (#ID) | Unique Question Identifier | Database `bank_questions.id` | Support tickets, logs, audits, imports |
| **Question** | The actual question text | Database `question_text` | Preview, editing, search |
| **Type** | Question format (MCQ, Essay, etc.) | Database `question_type` | Content filtering, exam building |
| **Subject** | Subject/course this question belongs to | Database `subjects.name` (joined) | Filtering, exam allocation, CSV export |
| **Class** | Grade/level this question targets | Database `class_level` | Filtering, prevent misuse, reporting |
| **Marks** | Point value | Database `marks` | Exam scoring, statistics |
| **Difficulty** | Easy/Medium/Hard | Database `difficulty` | Difficulty balancing, filtering |
| **Status** | Active/Draft/Inactive/Archived | Database `status` | Edit permissions, usage rights |
| **Used In** | Count of exams using this question | (Future: exam_questions FK) | Prevents deletion, shows impact |
| **Actions** | Edit, More Options, Delete | UI controls | Question management operations |

---

## 🎮 User Interface Components

### 1. **Header & Search**
**Purpose**: Quick access to create and search questions

- **"+ Create Question" Button**: Opens modal to create new question
- **Search Bar**: Real-time filtering by question text
- **Stats Summary**: Shows total questions, by status, by type

**Used For**: Navigation, quick discovery, content creation

---

### 2. **Filter Row**
**Purpose**: Narrow down questions by criteria

**Filters Available**:
- **Class Level** (Dropdown): Select SS1, SS2, SS3, etc.
  - Dynamically loads subjects for selected class
  - Prevents empty results from unrelated subjects
  
- **Subject** (Dropdown): Filtered by selected class
  - Only shows subjects offered in that class
  - Disabled until class is selected
  
- **Reset Filters** (Button): Clear all filters and reload full list

**How It Works**:
1. User selects Class → API fetches subjects for that class
2. Subject dropdown populates
3. User selects Subject → Table filters to matching questions
4. Table shows only questions for that Class + Subject combination

**Used For**: Finding specific questions without scrolling, exam prep, content audit

---

### 3. **Main Data Table**
**Purpose**: Display all filtered questions in organized format

**Key Features**:

#### Select All Section (Top of Table)
- **Header Checkbox**: Select/deselect all visible questions at once
- **Count Display**: Shows "X of Y selected" when items are selected
- **Bulk Actions** (Conditional):
  - **Export** (Green): Downloads selected questions as CSV
  - **Delete** (Red): Removes selected questions (respecting status rules)

#### Table Rows
Each row represents one question with:
- **Selectable**: Individual checkbox for batch operations
- **Color Highlighting**: Blue background when selected
- **Hover Effects**: Gray background on hover for visibility
- **Truncated Text**: Question text truncated with tooltip on hover

#### Empty State
- **Icon + Message**: Shows "No questions found" when filters return zero results
- **Professional Display**: Guides user to adjust filters or create new question

---

### 4. **Action Buttons** (Per Question)

**Design**: 3-button layout with hover dropdown

#### Button 1: Edit (Blue)
- **Icon**: Pencil icon
- **Function**: Opens edit modal with pre-filled data
- **Behavior**: 
  - Blocked if question is **Active** (shows warning)
  - Opens form with all fields pre-populated
  - Loads subjects based on question's class
  - Maps backend types to UI types for display

#### Button 2: More Actions (Indigo, with Dropdown)
- **Icon**: Vertical dots
- **Hover Behavior**: Shows dropdown menu above button
- **Menu Options**:
  
  **A. Preview** (Blue item)
  - Displays rich question details in modal
  - Shows: QID, Question, Type, Marks, Difficulty, Status, Subject, Class, Created Date
  - If MCQ: Shows all options with green highlight for correct answer(s)
  - Professional card-based layout

  **B. View History** (Purple item)
  - Opens timeline of all question versions
  - Shows: Version number, timestamp, change notes, type, marks, difficulty
  - Current version marked with green badge
  - Revert button to restore previous versions
  - Professional header with icon

  **C. Duplicate** (Green item)
  - Creates exact copy of question
  - New copy set to **Draft** status
  - Gets "(Copy)" appended to question text
  - Useful for creating variations

  **D. Toggle Status** (Amber item)
  - Switches between Active ↔ Inactive only (Draft/Archived via edit)
  - Updates database immediately
  - Refreshes table with new status badge

#### Button 3: Delete (Red)
- **Icon**: Trash icon
- **Function**: Delete question permanently
- **Safety Rules**:
  - ❌ **Cannot delete** if status is Active or Archived
  - ✅ **Can delete** if status is Draft or Inactive
  - Shows helpful warning if blocked: "Set to Inactive or Archive instead"

---

## 📋 Modal: Create/Edit Question

**Purpose**: Form interface for creating new or editing existing questions

### Form Fields

#### Basic Information
- **Question Text** (Required, TextArea): The actual question content
- **Question Type** (Required, Dropdown):
  - Multiple Choice (Single) → `multiple_choice`
  - Multiple Choice (Multiple) → `multiple_select`
  - True/False → `true_false`
  - Short Answer → `short_answer`
  - Long Answer/Essay → `long_answer`

#### Classification
- **Class** (Required, Dropdown): Links to class_level on database
  - On selection: Auto-loads subjects for that class
  - Used for: Filtering, exam allocation, level-based reporting
  
- **Subject** (Required, Dropdown): Filtered by selected class
  - Disabled until class is chosen
  - Links to subject_id on database

#### Scoring
- **Marks** (Required, Number): Points for this question
- **Difficulty** (Required, Dropdown): Easy, Medium, Hard

#### Dynamic Sections (Based on Type)

**If Multiple Choice (Single/Multiple)**:
- Options list with:
  - Text input for each option
  - Radio button (Single) or Checkbox (Multiple) to mark correct answer(s)
  - Add/Remove option buttons
  - Minimum 2 options required

**If Essay/Text**:
- Max Words (Optional): Limit for student responses
- Marking Rubric (Optional): Guidance for manual marking

#### Advanced Fields
- Instructions (Optional): Special directions for this question
- Instructions appear in student exams

### Edit Mode Behavior

**When Editing**:
1. ✅ All fields **pre-fill** with existing data
2. ✅ Class and Subject **auto-load** from question's existing values
3. ✅ Subject dropdown **automatically populates** for that class
4. ✅ Question Type **maps** backend → UI format
5. ✅ Options **normalize** from database format
6. ✅ Status **preserved** (doesn't default to "Active")

**Protection**:
- ❌ Cannot edit if question is **Active**
- Shows warning: *"The question needs to be set to Inactive to Edit"*
- User must toggle status first

---

## 🎬 Operation Workflows

### Workflow 1: Creating a Question

```
1. Click "+ Create Question"
   ↓
2. Modal opens with empty form
   ↓
3. Fill in question details
   ├─ Select Class → Subjects auto-load
   ├─ Select Subject from that class
   ├─ Enter question text
   ├─ Select type → Options section appears if MCQ
   ├─ Add options with correct answer(s)
   └─ Set Marks & Difficulty
   ↓
4. Click "Create Question"
   ↓
5. Validation runs → Error messages if missing required fields
   ↓
6. API POST to /bank/questions
   ├─ Backend validates
   ├─ Creates record with Status = "Draft"
   ├─ Creates initial version (v1)
   └─ Returns with QID
   ↓
7. Success alert → Modal closes → Table reloads
   ↓
8. New question appears at top of table (Active status)
```

### Workflow 2: Editing a Question

```
1. Click Edit button on Inactive question
   ↓
2. Check: Is question Active?
   ├─ YES → Show warning "Set to Inactive to Edit" → Block action
   └─ NO → Continue
   ↓
3. Modal opens with all fields pre-filled
   ├─ Question text loads
   ├─ Class & Subject auto-load from database
   ├─ Type maps to UI equivalent
   ├─ Options load with correct answer(s) marked
   └─ All other fields populate
   ↓
4. User modifies desired fields
   ↓
5. Click "Update Question"
   ↓
6. Validation runs → Same as create
   ↓
7. API PUT to /bank/questions/{id}
   ├─ Backend validates
   ├─ Updates record fields
   ├─ Deletes old options & recreates new ones
   ├─ Creates new version (v2, v3, etc.)
   └─ Preserves Status (doesn't force Active)
   ↓
8. Success alert → Modal closes → Table reloads with changes
```

### Workflow 3: Previewing a Question

```
1. Click "More Actions" dropdown → "Preview"
   ↓
2. API GET /bank/questions/{id}
   ↓
3. Professional modal opens showing:
   ├─ QID: #123
   ├─ Full question text (large, readable)
   ├─ Grid of metadata cards:
   │  ├─ Question Type
   │  ├─ Marks
   │  ├─ Difficulty
   │  ├─ Status
   │  ├─ Subject
   │  ├─ Class Level
   │  └─ Created Date
   ├─ If MCQ: All options
   │  └─ Correct answers highlighted green
   └─ Close button
```

### Workflow 4: Viewing Version History

```
1. Click "More Actions" dropdown → "View History"
   ↓
2. Version History modal opens with header & icon
   ↓
3. API GET versions for this question
   ↓
4. Timeline displays (newest first):
   ├─ Version number badge (v1, v2, v3...)
   ├─ "Current" badge (green) on latest version
   ├─ Change notes (e.g., "Updated difficulty")
   ├─ Timestamp (formatted date & time)
   ├─ Metadata cards: Type, Marks, Difficulty, Status
   └─ Revert button (orange) for old versions only
   ↓
5. To restore old version:
   └─ Click "Revert" → Confirm → Creates new version → Reloads
```

### Workflow 5: Deleting a Question

```
1. Click Delete button (Red trash icon)
   ↓
2. Check: Is question Active or Archived?
   ├─ YES → Show warning modal:
   │  ├─ Title: "Cannot Delete"
   │  ├─ Reason: "Active/Archived questions cannot be deleted"
   │  ├─ Suggestion: "Set to Inactive or Draft, or Archive instead"
   │  └─ Button: "OK"
   └─ NO → Continue
   ↓
3. Show confirmation: "Delete question #123?"
   ↓
4. User clicks "Yes"
   ↓
5. API DELETE /bank/questions/{id}
   ├─ Backend checks: Is question Active/Archived?
   │  └─ If YES: Return 409 Conflict error
   └─ If NO: Delete record
   ↓
6. Success message → Question removed from table
```

### Workflow 6: Bulk Operations

```
A. BULK SELECT
   1. Click checkbox in "Select All" row
   2. All visible questions toggle selected
   3. Count updates: "X of Y selected"
   
B. BULK EXPORT
   1. With questions selected, click "Export" button
   2. API POST to /bank/questions/export with selected IDs
   3. CSV file downloads:
      QID, Question Text, Type, Marks, Difficulty, Status, Subject, Class, Created
   4. Open in Excel for analysis
   
C. BULK DELETE
   1. With questions selected, click "Delete" button
   2. Confirmation: "Delete X questions?"
   3. API POST /bank/questions/bulk-delete with IDs
   4. Backend filters: Only deletes non-Active/Archived
   5. If some blocked: Shows count of deleted + count of blocked
   
D. BULK STATUS UPDATE
   1. Select questions → More options menu → "Change Status"
   2. Choose new status (Active, Inactive, Draft, Archived)
   3. API POST /bank/questions/bulk-status
   4. Updates all selected at once
```

### Workflow 7: Filtering & Search

```
1. User arrives at Question Management
   ↓
2. Table shows ALL questions (paginated)
   ↓
3. User types in search box
   ├─ Real-time filter on question_text
   └─ Table updates as typing
   ↓
4. User selects Class from dropdown
   ├─ API GET /subjects?class_level={Class}
   ├─ Subject dropdown populates
   └─ Table filters by class_level
   ↓
5. User selects Subject
   ├─ Table filters by subject_id + class_level
   └─ Shows only questions for that combination
   ↓
6. User clicks "Reset filters"
   ├─ All filters clear
   ├─ Search box empties
   └─ Full table reloads
```

---

## 🗄️ Database Integration

### Tables Used

#### `bank_questions` (Primary)
```
- id: Auto-increment
- question_text: Longtext
- question_type: Enum (multiple_choice, multiple_select, true_false, short_answer, long_answer, file_upload)
- marks: Integer
- difficulty: Enum (Easy, Medium, Hard)
- subject_id: Foreign Key → subjects.id
- class_level: String (e.g., "SS1", "SS2")
- instructions: Text (for marking guides)
- status: Enum (Draft, Pending Review, Active, Inactive, Archived)
- created_by: User ID
- created_at: Timestamp
- updated_at: Timestamp
```

#### `bank_question_options` (MCQ Options)
```
- id
- bank_question_id: Foreign Key → bank_questions.id
- option_text: Text
- is_correct: Boolean
- sort_order: Integer
```

#### `bank_question_versions` (Audit Trail)
```
- id
- bank_question_id: Foreign Key → bank_questions.id
- version_number: Integer (1, 2, 3...)
- question_text: Text (snapshot)
- question_type: Text (snapshot)
- marks: Integer (snapshot)
- difficulty: Text (snapshot)
- instructions: Text (snapshot)
- change_notes: Text ("Updated difficulty", "Initial version")
- created_by: User ID
- created_at: Timestamp
```

#### `subjects` (Linked)
```
- id
- name: String
- code: String
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/bank/questions` | List with filters (subject, class, type, difficulty, status, search) |
| POST | `/api/bank/questions` | Create new question |
| GET | `/api/bank/questions/{id}` | Get single question with options & versions |
| PUT | `/api/bank/questions/{id}` | Update question & options |
| DELETE | `/api/bank/questions/{id}` | Delete (only if not Active/Archived) |
| POST | `/api/bank/questions/{id}/duplicate` | Clone question to Draft |
| POST | `/api/bank/questions/bulk-delete` | Delete multiple (respects status rule) |
| POST | `/api/bank/questions/bulk-status` | Update status for multiple |
| GET | `/api/bank/questions/{id}/versions` | Get version history |
| POST | `/api/bank/questions/{id}/revert/{version}` | Restore to old version |
| GET | `/api/subjects?class_level={level}` | Get subjects for class |

---

## 🛡️ Business Rules & Validation

### Status Rules

| Status | Can Edit? | Can Delete? | Can Use in Exam? | Purpose |
|--------|-----------|-------------|-----------------|---------|
| **Draft** | ✅ Yes | ✅ Yes | ❌ No | Work-in-progress, not ready |
| **Pending Review** | ✅ Yes | ✅ Yes | ❌ No | Awaiting QA approval |
| **Active** | ❌ No | ❌ No | ✅ Yes | Published, in use |
| **Inactive** | ✅ Yes | ✅ Yes | ❌ No | Temporarily disabled |
| **Archived** | ❌ No | ❌ No | ❌ No | Historical, read-only |

### Question Type Rules

- **Multiple Choice (Single)**: Must have 2+ options, exactly 1 marked correct
- **Multiple Choice (Multiple)**: Must have 2+ options, 1+ marked correct
- **True/False**: Auto-creates 2 options (True, False)
- **Short Answer**: Requires expected answer
- **Long Answer/Essay**: Requires marking rubric
- **File Upload**: Specifies file types accepted

### Edit Prevention Logic

```
IF question.status == 'Active' THEN
  ❌ Show warning: "Set to Inactive to Edit"
  Block Edit button
ELSE IF question.status == 'Archived' THEN
  ❌ Block Edit (cannot change archived questions)
ELSE
  ✅ Allow Edit
```

### Delete Prevention Logic

```
IF question.status IN ('Active', 'Archived') THEN
  ❌ Show warning: "Cannot delete Active/Archived questions"
  ❌ Suggest: "Archive or set to Inactive instead"
ELSE
  ✅ Allow Delete → Permanent removal
```

---

## 📈 What This Module Will Support

### Now (Currently Implemented)
✅ Create, read, update, delete questions  
✅ Filter by class, subject, type, difficulty, status  
✅ Search by question text  
✅ Bulk export to CSV  
✅ Bulk delete (respecting status)  
✅ Duplicate questions  
✅ Toggle status  
✅ Preview detailed view  
✅ Version history & rollback  
✅ Subject & class visibility  
✅ Question ID tracking  

### Near Future (Prepared For)
🟡 **Used In Column** → Link to exams using this question
  - Prevents deletion if used
  - Shows impact before changes
  - Prevents accidental modifications

🟡 **Activity Audit Log** → Track who created/edited when
  - Already stored with `created_by` fields
  - Version history has change_notes
  - Can add full audit trail UI

🟡 **CSV Import** → Bulk upload questions
  - Validate format
  - Preview before saving
  - Error reporting

🟡 **Question Pools/Tags** → Organize by topic
  - Auto-select for exams
  - Support adaptive testing
  - Better categorization

### Later (Architecture Ready)
🔵 **Question Analytics**
  - Usage frequency
  - Difficulty calibration
  - Student performance per question
  - Discrimination index

🔵 **Question Collaboration**
  - Peer review workflow
  - Comments & suggestions
  - Approval chain

🔵 **Advanced Filtering**
  - Save filter presets
  - Smart recommendations
  - Trending/popular questions

---

## 🎨 Design Principles

### Visual Hierarchy
- Large headers for section titles
- Gradients for key areas (blue to purple)
- Color coding for status (green = active, red = delete, orange = warning)
- Icons for quick visual scanning

### Accessibility
- All buttons have clear labels & titles
- Hover states for interactivity feedback
- Keyboard navigation support
- Proper semantic HTML

### Performance
- Lazy load on scroll (pagination)
- Efficient API queries with filtering
- Client-side search with debouncing
- Batch operations for bulk actions

### Mobile Responsiveness
- Responsive table layout
- Touch-friendly buttons
- Adaptive filter row
- Mobile-optimized modals

---

## 🚀 Usage Recommendations

### For Daily Operations
1. **Filter by Class + Subject** to find questions for specific exams
2. **Search** for specific question keywords
3. **Preview** before using in exams
4. **Export** for backup or analysis

### For Maintenance
1. **Review Draft questions** regularly
2. **Archive old questions** instead of deleting (for history)
3. **Check version history** before major edits
4. **Duplicate** good questions as templates for variations

### For Quality Assurance
1. **Set to Pending Review** before marking Active
2. **Toggle status** to test without affecting active exams
3. **View history** to see what changed
4. **Preview** to verify format before publishing

---

## 📞 Support Workflow

When users report issues with a specific question:

1. **Find by QID**: Search or scroll to #123
2. **Preview**: See exactly what students see
3. **Check History**: View all changes (who, when, what)
4. **Revert if needed**: Go back to working version
5. **Edit & Update**: Make corrections
6. **Archive**: Retire problematic questions

---

## Summary

The Question Management module is a **complete, professional question bank system** that handles the full lifecycle of exam questions from creation through archival. It integrates tightly with the database for data integrity, provides powerful filtering and bulk operations for efficiency, and maintains a complete audit trail for accountability.

**It's ready for production use and supports future enhancements** like question usage tracking, bulk import, and advanced analytics without requiring architectural changes.
