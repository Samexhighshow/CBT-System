# Assessment Mode and Result Display Mapping

## Purpose
This document explains how `assessment_display_mode` affects:
- attempt creation
- Admin Results table labels/positioning
- PDF/Excel report output

It also clarifies why Exam Mode and CA Test rows can both exist for the same student on one exam.

## 1. Where Mode Is Set
Admin sets mode in Settings:
- File: `frontend/src/pages/admin/AdminSettings.tsx`
- Setting key: `assessment_display_mode`
- Values:
  - `auto`
  - `exam`
  - `ca_test`

UI labels in settings:
- `Auto (Use neutral "Assessment" labels)`
- `Exam Mode Labels`
- `CA Test Mode Labels`

## 2. How Attempt Mode Is Chosen and Stored
Attempt mode is resolved at verification/attempt creation time:
- File: `backend/app/Http/Controllers/Api/CbtInterfaceController.php`
- Method: `resolveAttemptMode(Exam $exam)`

Rules:
1. If system setting is explicitly `exam` or `ca_test`, that value is used.
2. If setting is `auto`, fallback uses exam config (`exam.assessment_type`):
   - `ca test` -> `ca_test`
   - anything else -> `exam`

When attempt is created, mode is saved on each attempt row:
- Column: `exam_attempts.assessment_mode`
- This snapshot prevents old attempts from being re-labeled when global setting changes later.

## 3. Mode-Aware Attempt Scoping
Attempt queries are mode-scoped so CA and Exam attempts are not mixed:
- File: `backend/app/Http/Controllers/Api/CbtInterfaceController.php`
- Method: `applyAttemptModeScope($query, string $mode)`

Behavior:
- `ca_test` mode -> only `assessment_mode = 'ca_test'`
- `exam` mode -> `assessment_mode = 'exam'` OR `NULL` (legacy rows)

## 4. Admin Results Table: Position and Data Source
UI table location:
- File: `frontend/src/pages/admin/ResultsAnalytics.tsx`
- Section: Exam Results table

Column order in the Admin table:
1. Student
2. Class
3. Score (%)
4. Grade
5. Subject Position
6. Status
7. Total Questions
8. Time Taken
9. Attempt Date
10. Assessment Type

The `Assessment Type` column is the last column in that table.

Data source for the table:
- Frontend calls: `/marking/exams/{examId}/attempts`
- Backend file: `backend/app/Http/Controllers/Api/MarkingController.php`
- Field returned per row: `assessment_type`

Current label resolution for that field:
1. Use `attempt.assessment_mode` first:
   - `ca_test` -> `CA Test`
   - `exam` -> `Final Exam`
2. Fallback to `exam.assessment_type`
3. Default: `Final Exam`

## 5. Printing (PDF) Behavior
Exam Print Sheet endpoint:
- `GET /reports/exam/{examId}/pdf`
- Controller: `backend/app/Http/Controllers/Api/ReportController.php`
- View: `backend/resources/views/reports/exam-report.blade.php`

Important grouping behavior:
- Report now keeps latest attempt per `student + component` where component is:
  - `ca`
  - `exam`
- This prevents one mode from overwriting the other in the PDF dataset.

Assessment Type shown in PDF table uses:
- `report_assessment_type` (attempt-mode-first logic)
- Fallback: exam assessment type

## 6. Excel Export Behavior
Exam Excel endpoint:
- `GET /reports/exam/{examId}/excel`
- Export class: `backend/app/Exports/ExamResultsExport.php`

Student Excel endpoint:
- `GET /reports/student/{studentId}/excel`
- Export class: `backend/app/Exports/StudentResultsExport.php`

Both exports now include explicit column:
- `Assessment Type`

Label source in both exports:
1. `attempt.assessment_mode` first (`CA Test`/`Final Exam`)
2. fallback to `exam.assessment_type`
3. default `Final Exam`

## 7. Why You May See Two Rows for One Student
Seeing two rows for one student in exam context is valid if both components exist:
- one row from CA-mode attempt
- one row from Exam-mode attempt

This is expected after mode switching and does not mean one row is overriding another.

## 8. Practical Verification Checklist
1. In Admin Settings, confirm `assessment_display_mode` value.
2. Open Admin Results table and inspect the last column `Assessment Type`.
3. Download PDF and confirm `Assessment Type` column in report rows.
4. Export Excel and confirm `Assessment Type` column values match table/report.
5. For mixed historical data, confirm separate rows for `CA Test` and `Final Exam` where applicable.
