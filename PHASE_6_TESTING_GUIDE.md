# Phase 6: Complete Testing Guide

## Test Environment Setup

### Prerequisites
1. Phase 5 fully deployed
2. Database migration applied
3. Backend API running (`php artisan serve`)
4. Frontend running (`npm run dev`)
5. Sample data with various question types

### Sample Data Script
```sql
-- Ensure test data exists with all fields populated
UPDATE exam_questions 
SET difficulty = 'easy', status = 'active', section_name = 'Part A' 
WHERE id <= 10;

UPDATE exam_questions 
SET difficulty = 'medium', status = 'draft', section_name = 'Part B' 
WHERE id > 10 AND id <= 20;

UPDATE exam_questions 
SET difficulty = 'hard', status = 'disabled', section_name = 'Part C' 
WHERE id > 20;
```

---

## Test Cases

### Category 1: Component Rendering

#### Test 1.1: QuestionFilters Renders
```
Steps:
1. Navigate to Question Bank
2. Select an exam
3. Observe filter panel

Expected:
- Filter panel visible
- 4 dropdown fields visible
- "Clear Filters" button present
- No console errors
```

#### Test 1.2: QuestionTable Renders
```
Steps:
1. Select exam with questions
2. View all questions option
3. Observe table

Expected:
- Table displays with all columns
- Headers: ☐, #, Question, Type, Marks, Difficulty, Status, Section, Actions
- All questions visible
- Proper data in each column
```

#### Test 1.3: BulkActionToolbar Hidden Initially
```
Steps:
1. Open question bank
2. Observe bottom of screen

Expected:
- No toolbar visible initially
- No interference with page layout
```

#### Test 1.4: SectionGroup Renders
```
Steps:
1. Click "By Section" toggle
2. Observe section grouping

Expected:
- Questions grouped by section
- Gradient headers visible
- Expand/collapse icons present
- Each section collapsible
```

---

### Category 2: Filtering Functionality

#### Test 2.1: Filter by Question Type
```
Steps:
1. Click Filters (expand if needed)
2. Select "multiple_choice_single" from Type dropdown
3. Observe results

Expected:
- Only MCQ (single answer) questions shown
- Count updates to match filtered questions
- All other questions hidden
- Unselected filters show "All"
```

#### Test 2.2: Filter by Difficulty
```
Steps:
1. Select "hard" from Difficulty dropdown
2. Observe results

Expected:
- Only hard questions shown
- Difficulty column shows "Hard" for all
- Count updates
- Color-coded hard (red) badges visible
```

#### Test 2.3: Filter by Status
```
Steps:
1. Select "active" from Status dropdown
2. Observe results

Expected:
- Only active questions shown
- Status column shows "Active" for all
- Color-coded badges visible
- Disabled and draft questions hidden
```

#### Test 2.4: Filter by Section
```
Steps:
1. Select "Part A" from Section dropdown
2. Observe results

Expected:
- Only Part A questions shown
- Section column shows "Part A" for all
- Questions from other sections hidden
```

#### Test 2.5: Multiple Filters (AND Logic)
```
Steps:
1. Select Type: multiple_choice_single
2. Select Difficulty: medium
3. Select Status: active
4. Select Section: Part B
5. Observe results

Expected:
- Only questions matching ALL criteria shown
- Filter badge shows count of active filters (4)
- Correct combination of conditions applied
- Empty state if no match
```

#### Test 2.6: Clear Filters
```
Steps:
1. Apply multiple filters
2. Click "Clear Filters" button
3. Observe results

Expected:
- All dropdowns reset to "All"
- All questions visible again
- Filter count badge disappears
- Results update immediately
```

#### Test 2.7: Filter Persists with Search
```
Steps:
1. Apply filter: Type = essay
2. Type in search: "photosynthesis"
3. Observe results

Expected:
- Only essay questions with "photosynthesis" in text shown
- Filter and search applied together
- Both constraints respected
```

---

### Category 3: Selection Management

#### Test 3.1: Single Selection
```
Steps:
1. Click checkbox for first question
2. Observe UI

Expected:
- Checkbox is checked
- Row background changes to light blue
- BulkActionToolbar appears at bottom
- Selected count = 1
```

#### Test 3.2: Multiple Selection
```
Steps:
1. Check 3 different questions
2. Observe UI

Expected:
- All 3 checkboxes checked
- All 3 rows highlighted
- Toolbar shows "3 selected"
- Clear button present
```

#### Test 3.3: Select All in Header
```
Steps:
1. Click checkbox in table header
2. Observe all rows

Expected:
- All question checkboxes checked
- All rows highlighted
- Toolbar shows correct count
- Header checkbox remains checked
```

#### Test 3.4: Select All with Filters Applied
```
Steps:
1. Apply filter: Difficulty = hard
2. Click header checkbox
3. Observe

Expected:
- Only hard question checkboxes checked
- Count matches hard questions only
- Unchecking one unchecks header
```

#### Test 3.5: Selection Persists When Filtering
```
Steps:
1. Check 5 questions
2. Apply a filter (e.g., Type = MCQ)
3. Remove filter
4. Observe

Expected:
- Selection preserved if questions still visible
- Selection cleared if questions filtered out
- Toolbar updates accordingly
```

#### Test 3.6: Deselect Individual
```
Steps:
1. Check all questions
2. Uncheck one question
3. Observe header checkbox

Expected:
- One checkbox unchecked
- Row no longer highlighted
- Header checkbox becomes partially checked/unchecked
- Count decreases
```

---

### Category 4: Bulk Operations

#### Test 4.1: Bulk Delete
```
Steps:
1. Select 2 questions
2. Click "Delete Selected" in toolbar
3. Confirm in dialog
4. Observe

Expected:
- Confirmation dialog appears
- Asks "Delete 2 question(s)?"
- Loading indicator during operation
- Questions removed from list
- Selection cleared
- Success message shown
```

#### Test 4.2: Bulk Delete Cancellation
```
Steps:
1. Select questions
2. Click "Delete Selected"
3. Click "Cancel" in dialog
4. Observe

Expected:
- Dialog closes
- No deletion occurs
- Selection preserved
- Toolbar still visible
```

#### Test 4.3: Bulk Status Update to Active
```
Steps:
1. Select disabled questions
2. Choose "Active" from toolbar dropdown
3. Observe

Expected:
- Status field updates to "Active"
- Green badge appears
- Questions remain visible (not deleted)
- Selection cleared after update
```

#### Test 4.4: Bulk Status Update to Draft
```
Steps:
1. Select active questions
2. Choose "Draft" from toolbar dropdown
3. Observe

Expected:
- Status changes to "Draft"
- Blue badge appears
- Changes applied to all selected
- Toolbar closes
```

#### Test 4.5: Bulk Status Update to Disabled
```
Steps:
1. Select active questions
2. Choose "Disabled" from toolbar dropdown
3. Observe

Expected:
- Status changes to "Disabled"
- Red badge appears
- Questions still in list (not deleted)
```

#### Test 4.6: Clear Selection Button
```
Steps:
1. Select multiple questions
2. Click "Clear" button in toolbar
3. Observe

Expected:
- All checkboxes unchecked
- All row highlights removed
- Toolbar disappears
- Count resets to 0
```

---

### Category 5: Section Grouping

#### Test 5.1: View Toggle - To Sections
```
Steps:
1. Click "By Section" toggle (top right)
2. Observe layout

Expected:
- Questions grouped under sections
- Each section has gradient header
- Section name displayed
- Statistics shown (count, marks)
- Expand/collapse arrows present
```

#### Test 5.2: View Toggle - To All
```
Steps:
1. Toggle "By Section" → "All"
2. Observe layout

Expected:
- Questions displayed in single table
- No section headers
- All questions visible at once
- Same table structure as before
```

#### Test 5.3: Expand/Collapse Section
```
Steps:
1. View by section
2. Click expand/collapse arrow on section header
3. Observe

Expected:
- Section expands to show questions
- Section collapses to hide questions
- Arrow direction changes
- Header remains visible
- Other sections unaffected
```

#### Test 5.4: Section Select All
```
Steps:
1. View by section
2. Click checkbox in section header
3. Observe

Expected:
- All questions in that section checked
- Other sections unaffected
- Row count in toolbar correct
- Header checkbox for section shows all checked
```

#### Test 5.5: Section Statistics
```
Steps:
1. View by section
2. Check section header

Expected:
- Section name displayed
- Count of questions shown
- Total marks shown
- Selected count shown (if any checked)
```

#### Test 5.6: Bulk Operation with Sections
```
Steps:
1. View by section
2. Select questions from different sections
3. Bulk delete or update status
4. Observe

Expected:
- Bulk operation applies to all selected, regardless of section
- All selected sections updated
- Selection works across sections
```

---

### Category 6: Quick Actions (Per Question)

#### Test 6.1: Preview Action
```
Steps:
1. Click eye icon on any row
2. Observe

Expected:
- Loading indicator appears briefly
- Preview fetched from API
- Modal or message shows question details
- No page reload
```

#### Test 6.2: Duplicate Action
```
Steps:
1. Click copy icon on any row
2. Observe

Expected:
- Loading indicator appears
- API call made to /questions/{id}/duplicate
- New question appears in list
- Success message shown
- New question has same content as original
```

#### Test 6.3: Edit Action
```
Steps:
1. Click pencil icon on any row
2. Observe

Expected:
- Question edit modal opens
- Form populated with question data
- All fields editable
- Save button available
- Can update and save changes
```

#### Test 6.4: Toggle Status Action
```
Steps:
1. Click toggle icon on active question
2. Observe

Expected:
- Status changes (active → disabled or vice versa)
- Badge color changes
- No modal opened
- Immediate update
- Success message shown
```

#### Test 6.5: Delete Action
```
Steps:
1. Click trash icon on any row
2. Click confirm in dialog
3. Observe

Expected:
- Confirmation dialog appears
- "Delete this question?" message
- Cancel button available
- On confirm: question removed
- Success message shown
- Selection cleared if question was selected
```

#### Test 6.6: Context Menu (Right-Click)
```
Steps:
1. Right-click on any row
2. Observe menu

Expected:
- Context menu appears at cursor location
- All 5 actions visible (Preview, Duplicate, Edit, Toggle, Delete)
- Icons for each action
- Clicking action executes it
- Menu closes after action or click outside
```

---

### Category 7: Search Integration

#### Test 7.1: Search by Question Text
```
Steps:
1. Type "photosynthesis" in search box
2. Observe results

Expected:
- Only questions with "photosynthesis" in text shown
- Search is case-insensitive
- Count updates
- Other questions hidden
```

#### Test 7.2: Search with Filters
```
Steps:
1. Apply filter: Type = essay
2. Search: "photosynthesis"
3. Observe

Expected:
- Only essay questions with "photosynthesis" shown
- Both constraints applied
- Empty state if no match
```

#### Test 7.3: Clear Search
```
Steps:
1. Type search text
2. Delete all text
3. Observe

Expected:
- All questions visible again (if filters allow)
- No placeholder text shown
- Count updates to include all matching filters
```

---

### Category 8: Responsiveness

#### Test 8.1: Desktop View (1920x1080)
```
Steps:
1. Open browser at full width
2. Observe layout

Expected:
- All 9 table columns visible
- No horizontal scroll
- Toolbar at correct position
- Filter panel expands fully
```

#### Test 8.2: Tablet View (768x1024)
```
Steps:
1. Resize browser to 768px width
2. Observe layout

Expected:
- Table scrollable horizontally
- Core columns visible
- Less important columns may be hidden or small
- Mobile-optimized layout
- Touch-friendly checkboxes
```

#### Test 8.3: Mobile View (375x667)
```
Steps:
1. Resize to mobile width
2. Observe layout

Expected:
- Table is compact
- Horizontal scroll available
- Essential columns visible
- Filters collapsible
- Toolbar functional on small screen
- Checkboxes large enough to click
```

#### Test 8.4: Mobile Landscape (667x375)
```
Steps:
1. Rotate to landscape
2. Observe layout

Expected:
- More columns visible than portrait
- Still scrollable if needed
- Layout adapts properly
```

---

### Category 9: Error Handling

#### Test 9.1: Bulk Delete Error
```
Steps:
1. Select questions
2. Network tab: Block POST /bulk-delete
3. Click delete
4. Observe

Expected:
- Error message displayed
- Selection NOT cleared
- Can retry operation
- No partial deletions
```

#### Test 9.2: API Timeout
```
Steps:
1. Select questions
2. Network tab: Throttle (slow 3G)
3. Perform bulk operation
4. Observe timeout

Expected:
- Loading indicator shows for duration
- Timeout handled gracefully
- Error message shown
- User can retry
```

#### Test 9.3: Invalid Data Response
```
Steps:
1. Mock API to return invalid data
2. Try to load/filter questions
3. Observe

Expected:
- Error message or empty state
- No console crashes
- Can still interact with UI
- Can reload/refresh
```

---

### Category 10: Performance

#### Test 10.1: Load 100 Questions
```
Steps:
1. Create exam with 100 questions
2. Load question bank
3. Time initial render

Expected:
- Initial load: <2 seconds
- List renders completely
- No UI freezes
- Can scroll smoothly
```

#### Test 10.2: Filter Performance
```
Steps:
1. Loaded with 100 questions
2. Apply filter
3. Time filter application

Expected:
- Filter applied: <100ms
- Results appear instantly
- No lag while typing
- Smooth transitions
```

#### Test 10.3: Bulk Operation Performance
```
Steps:
1. Select 20 questions
2. Perform bulk delete/update
3. Observe

Expected:
- Operation completes: 1-5 seconds
- Loading indicator visible
- List refreshes smoothly
- No UI lag during operation
```

#### Test 10.4: Memory Usage
```
Steps:
1. Open DevTools Memory tab
2. Load 100 questions
3. Apply filters several times
4. Perform bulk operations

Expected:
- Memory usage reasonable (~2-5MB for component)
- No memory leaks
- Garbage collection works
- No increasing memory over time
```

---

### Category 11: Data Integrity

#### Test 11.1: Bulk Delete Consistency
```
Steps:
1. Select 5 questions
2. Delete them
3. Check database directly
4. Observe

Expected:
- Exactly 5 questions deleted
- Correct questions deleted (by ID)
- No other questions affected
- Timestamp updated
```

#### Test 11.2: Bulk Status Update Consistency
```
Steps:
1. Select 3 questions with mixed status
2. Update all to "active"
3. Check database
4. Reload page

Expected:
- All 3 have status = 'active' in database
- Badge shows active for all 3
- Change persists after reload
- No other fields modified
```

#### Test 11.3: Duplicate Consistency
```
Steps:
1. Duplicate a question
2. Check new question in database
3. Compare with original
4. Observe

Expected:
- New question is exact copy except ID
- Same text, type, marks, difficulty, section
- Unique ID assigned
- Timestamps are new
- order_index incremented appropriately
```

---

### Category 12: Edge Cases

#### Test 12.1: Empty Exam
```
Steps:
1. Create exam with no questions
2. Open question bank
3. Select exam
4. Observe

Expected:
- Empty state message shown
- "No questions found"
- Action cards visible
- No errors
```

#### Test 12.2: All Questions Filtered Out
```
Steps:
1. Apply filter with no matches
2. Observe

Expected:
- Empty state message shown
- "No questions match your filters"
- Filter panel still accessible
- Can clear filters
```

#### Test 12.3: Deselect All Manually
```
Steps:
1. Check all questions
2. Uncheck header checkbox
3. Observe

Expected:
- All checkboxes unchecked
- Toolbar disappears
- Clean UI
- Can reselect
```

#### Test 12.4: Scroll to End and Select
```
Steps:
1. Scroll to bottom of large question list
2. Check last question
3. Scroll to top
4. Observe

Expected:
- Selection persists
- Toolbar shows at bottom
- Scrolling doesn't clear selection
```

#### Test 12.5: Rapid Filter Changes
```
Steps:
1. Change filters rapidly (Type, Difficulty, Status, Section)
2. Observe

Expected:
- UI doesn't freeze
- Latest filter state applied
- No race conditions
- Smooth transitions
```

---

## Regression Tests

### After Each Deployment

#### RT 1: Existing Functionality
```
Verify:
- Old question bank features still work
- Create/edit/delete individual questions
- CSV import/export
- Form validation
```

#### RT 2: Integration with Other Modules
```
Verify:
- Exam management still works
- Navigation still works
- Authentication still works
- API integration still works
```

#### RT 3: Database Integrity
```
Verify:
- No orphaned records
- Foreign keys intact
- Indexes present
- Timestamps updated correctly
```

---

## Load Testing

### Prepare Large Dataset
```sql
-- Insert 500 test questions
INSERT INTO exam_questions (exam_id, question_text, question_type, marks, difficulty, status, section_name, order_index, created_at, updated_at)
SELECT 1, CONCAT('Question ', id), 'multiple_choice_single', 1, 'easy', 'active', 'Part A', id, NOW(), NOW()
FROM (SELECT @row := @row + 1 as id FROM information_schema.tables, (SELECT @row := 0) r LIMIT 500) t;
```

### Load Test Scenarios

#### Scenario 1: Many Questions
```
Setup: 500 questions
Test: Load question bank and apply filters
Expected: <3 seconds initial load, instant filters
```

#### Scenario 2: Concurrent Users
```
Setup: 2-3 users simultaneously accessing same exam
Test: Edit, filter, bulk operations
Expected: No data conflicts, all operations succeed
```

#### Scenario 3: Large Bulk Operations
```
Setup: 100 questions selected
Test: Bulk delete 50 questions
Expected: Operation completes in <5 seconds
```

---

## Security Testing

### Verify Access Control
```
Test Cases:
1. Non-admin user cannot see admin questions
2. User cannot delete questions from other exams
3. User cannot modify question data via API
4. CSRF tokens validated
5. Input validation on all fields
```

### Verify Data Protection
```
Test Cases:
1. Bulk operations are transaction-safe
2. No partial operations on failure
3. Audit logs created
4. User ID tracked for changes
5. Timestamps accurate
```

---

## Test Report Template

```markdown
## Phase 6 Test Report

**Date**: [Date]
**Tester**: [Name]
**Build**: [Version]

### Summary
- Total Tests: 
- Passed: 
- Failed: 
- Blocked: 

### Test Results by Category
- Component Rendering: [PASS/FAIL]
- Filtering: [PASS/FAIL]
- Selection: [PASS/FAIL]
- Bulk Operations: [PASS/FAIL]
- Sections: [PASS/FAIL]
- Actions: [PASS/FAIL]
- Search: [PASS/FAIL]
- Responsive: [PASS/FAIL]
- Error Handling: [PASS/FAIL]
- Performance: [PASS/FAIL]
- Data Integrity: [PASS/FAIL]
- Edge Cases: [PASS/FAIL]

### Failures
[List any failures with details]

### Blockers
[List any blocking issues]

### Recommendations
[Notes for improvement]

### Sign-Off
[Approved/Rejected with signature]
```

---

## Continuous Integration Tests

### GitHub Actions / CI Pipeline

```yaml
Test Steps:
1. Install dependencies (npm install)
2. Build project (npm run build)
3. Run linting (npm run lint)
4. Type checking (tsc --noEmit)
5. Unit tests (if added)
6. Screenshot comparison (responsive checks)
7. Deploy to staging
8. Smoke tests on staging
9. Performance tests
10. Report results
```

---

## Sign-Off Criteria

✅ All 12 test categories pass  
✅ No critical bugs found  
✅ Performance acceptable  
✅ Data integrity verified  
✅ Mobile responsive confirmed  
✅ Security reviewed  
✅ No regression issues  
✅ Documentation complete  

---

## Next Steps After Testing

1. **If All Tests Pass**:
   - Deploy to production
   - Monitor for issues
   - Gather user feedback
   - Plan Phase 6.1

2. **If Issues Found**:
   - Log bugs in tracker
   - Assign to developers
   - Re-test fixes
   - Update regression tests

3. **If Blockers Found**:
   - Escalate to team lead
   - Determine if Phase 6.1 features needed
   - Plan alternative approach
   - Document for Phase 7

---

**Testing Guide Complete**
