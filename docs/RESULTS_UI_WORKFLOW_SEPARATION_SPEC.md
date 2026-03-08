# Results UI Workflow Separation Spec

## Objective
Define a school-friendly Results module where CA/Test and Exam are managed separately, with a Compiled layer for final term output.

This spec includes:
- current Admin UI table positioning (as-is)
- current mode/label behavior
- target UI structure
- backend filtering and endpoint requirements
- export/print and broadsheet requirements

---

## 1. Current Admin UI Positioning (As-Is)

### Module location
- Page: `Results & Marking`
- File: `frontend/src/pages/admin/ResultsAnalytics.tsx`

### Exam Results table column order (current)
1. `Student`
2. `Class`
3. `Score (%)`
4. `Grade`
5. `Subject Position`
6. `Status`
7. `Total Questions`
8. `Time Taken`
9. `Attempt Date`
10. `Assessment Type`

`Assessment Type` is currently the last column in the table.

### Current data source for table
- Frontend fetches: `GET /marking/exams/{examId}/attempts`
- Backend source: `backend/app/Http/Controllers/Api/MarkingController.php`
- Current `assessment_type` label now resolves from `assessment_mode` first:
  - `ca_test` -> `CA Test`
  - `exam` -> `Final Exam`
  - fallback to exam-level assessment type

---

## 2. Current Mode Behavior (As-Is)

### Where system mode is set
- Setting key: `assessment_display_mode`
- Values: `auto`, `exam`, `ca_test`
- Admin UI: `frontend/src/pages/admin/AdminSettings.tsx`

### How attempt mode is stored
- At attempt creation time, backend writes `exam_attempts.assessment_mode`.
- Source: `backend/app/Http/Controllers/Api/CbtInterfaceController.php`

### Important rule
`assessment_mode` on the attempt is the authoritative snapshot for result classification.
Changing global mode later does not rewrite old attempts.

---

## 3. Problem to Solve
Schools need independent workflows for:
- CA/Test-only operations
- Exam-only operations
- Compiled/final result operations

A single mixed table causes confusion for:
- CA-only export
- Exam-only export
- separate CA imports
- final term compilation
- broadsheet/report card generation

---

## 4. Target Results Module Structure

Inside `Results & Marking`, split into:

1. `CA Test Results`
2. `Exam Results`
3. `Compiled Results`
4. `Broadsheet / Reports`

Recommended navigation hierarchy:
- Results & Marking
- CA Test Results
- Exam Results
- Compiled Results
- Subject Broadsheet
- Full Class Broadsheet
- Student Report Cards

---

## 5. CA Test Results Page (Target)

### Purpose
Show only CA/Test records.

### Filter rule
`assessment_mode = 'ca_test'`

### Required filters
- Session
- Term
- Class
- Subject
- Optional: test batch/date

### Table labels
- Use `CA Score` (not generic `Score`)

### Actions
- Export CA Excel
- Export CA PDF
- Print CA Sheet
- Import CA Scores
- Release/Hide CA results

---

## 6. Exam Results Page (Target)

### Purpose
Show only final exam records.

### Filter rule
`assessment_mode = 'exam'`

### Required filters
- Session
- Term
- Class
- Subject

### Table labels
- Use `Exam Score`

### Actions
- Export Exam Excel
- Export Exam PDF
- Print Exam Sheet
- Release/Hide Exam results

---

## 7. Compiled Results Page (Target)

### Purpose
Combine CA + Exam into final term subject result.

### Required scope
By Session + Term + Class + Subject.

### Display columns
- Student
- Class
- CA
- Exam
- Total (Compiled)
- Grade
- Position
- Remarks (optional)

### Actions
- Export Compiled Excel
- Export Compiled PDF
- Print Subject Broadsheet
- Generate Report Cards

---

## 8. Broadsheet Requirements (Target)

### Subject Broadsheet
One subject, one class, one term.

Columns:
- Student
- CA
- Exam
- Total
- Grade
- Position

### Full Class Broadsheet
All subjects for one class/term.

Columns (example):
- Student
- English
- Math
- BST
- CRS
- Total Average
- Grade
- Position

---

## 9. Export and Print Endpoints (Target)

Recommended dedicated routes:
- `GET /reports/ca/{examId}/pdf`
- `GET /reports/ca/{examId}/excel`
- `GET /reports/exam/{examId}/pdf`
- `GET /reports/exam/{examId}/excel`
- `GET /reports/compiled/{session}/term/{term}/class/{classId}/subject/{subjectId}/pdf`
- `GET /reports/compiled/{session}/term/{term}/class/{classId}/subject/{subjectId}/excel`
- `GET /reports/broadsheet/subject/{session}/term/{term}/class/{classId}/subject/{subjectId}/pdf`
- `GET /reports/broadsheet/class/{session}/term/{term}/class/{classId}/pdf`

If route expansion is deferred, support query param mode filtering on existing report endpoints as an interim step:
- `?mode=ca_test`
- `?mode=exam`

---

## 10. Backend Filtering Rules (Mandatory)

### CA page/query
Use:
`WHERE assessment_mode = 'ca_test'`

### Exam page/query
Use:
`WHERE assessment_mode = 'exam' OR assessment_mode IS NULL` for legacy compatibility only where needed.

### Compiled logic
Per student within session/term/class/subject:
1. fetch latest CA component rows
2. fetch latest Exam component rows
3. apply school weighting
4. compute compiled total
5. assign grade
6. compute position

---

## 11. UI Label Rules (Mandatory)

Avoid generic-only wording in operational pages.
Use explicit labels:
- CA page: `CA Score`
- Exam page: `Exam Score`
- Compiled page: `CA | Exam | Total`

Keep `Assessment Type` only where mixed historical lists are intentionally shown.

---

## 12. Positioning Summary for Admin Table

Current placement in Admin Exam Results table:
- `Assessment Type` is the 10th/last column.

For separated workflow pages:
- CA table: place `CA Score` as primary score column near student/class.
- Exam table: place `Exam Score` similarly.
- Compiled table: place `CA`, `Exam`, `Total` together in the center for readability.

---

## 13. Implementation Phases

### Phase 1 (UI separation)
- Add sub-tabs/pages: CA Results, Exam Results, Compiled Results.
- Apply frontend filters by `assessment_type`/`assessment_mode` from API payload.
- Update column labels (CA Score, Exam Score).

### Phase 2 (API hard filters)
- Add CA/Exam-specific result endpoints or mode query filters.
- Add CA-only and Exam-only report exports.

### Phase 3 (compiled and broadsheet)
- Subject compiled report endpoint.
- Full class broadsheet endpoint.
- Report card generation pipeline.

---

## 14. Acceptance Criteria

1. Admin can view CA-only rows without Exam rows mixed in.
2. Admin can view Exam-only rows without CA rows mixed in.
3. CA export excludes Exam rows.
4. Exam export excludes CA rows.
5. Compiled page shows CA + Exam + Total for same context.
6. PDF/Excel templates exist for each workflow layer.
7. Historical mixed attempts are correctly labeled by attempt mode.

---

## 15. Reference Files

- Admin Settings mode control:
  - `frontend/src/pages/admin/AdminSettings.tsx`
- Admin results UI table:
  - `frontend/src/pages/admin/ResultsAnalytics.tsx`
- Marking attempts payload for Admin table:
  - `backend/app/Http/Controllers/Api/MarkingController.php`
- Mode selection and attempt creation:
  - `backend/app/Http/Controllers/Api/CbtInterfaceController.php`
- Report generation:
  - `backend/app/Http/Controllers/Api/ReportController.php`
- Result aggregation:
  - `backend/app/Http/Controllers/Api/ResultController.php`
- Print templates:
  - `backend/resources/views/reports/exam-report.blade.php`
  - `backend/resources/views/reports/student-results.blade.php`
  - `backend/resources/views/reports/term-aggregate.blade.php`
