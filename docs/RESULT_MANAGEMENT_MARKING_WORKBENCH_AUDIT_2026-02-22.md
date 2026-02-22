# Result Management & Marking Workbench Audit

Date: 2026-02-22  
Workspace: `CBT-System`

## 1) Scope

This document inventories everything currently available for:
- Result Management
- Results Analytics
- Result Release/Visibility
- Cumulative Results (CR) + Term Compilation
- Marking Workbench (manual scoring)

It also marks what is **Implemented**, **Partially Implemented**, or **Not Implemented**.

---

## 2) Executive Status

### Implemented
- Admin **Results & Marking** dashboard (`/admin/results`)
- Admin **Marking Workbench** (`/admin/marking`) for manual scoring/finalization/reset
- Student **My Results** (`/student/results`) with attempt history + compiled term results + PDF/Excel download
- Result analytics endpoints and exam-level/attempt-level data retrieval
- Results visibility toggle per exam (`results_released` flag)
- CR/Term settings in Admin Settings (session, term, CA/Exam weight, cumulative toggle)
- Security event ingestion + visibility in marking workflow (tab warnings, blocked actions, switches)

### Partially Implemented
- Result release policy enforcement is only a visibility flag; student result endpoint currently does not enforce `results_released`
- Marking backend exposes `force-submit` and `extend-time`, but Marking Workbench UI does not expose these controls
- Two parallel result-controller paths exist (legacy + current), creating maintenance ambiguity

### Not Implemented / Missing
- No explicit role-scoped endpoint for teacher marking workbench access (current route is Admin/Main Admin only)
- No dedicated “release by cohort with approval workflow” (only bulk toggle by class/subject/exam filter)
- No explicit audit UI for `attempt_actions` (table exists, actions are logged)

---

## 3) Frontend Inventory

## 3.1 Admin

### A) Results & Marking page
- File: `frontend/src/pages/admin/ResultsAnalytics.tsx`
- Route: `/admin/results`
- Capabilities:
  - Loads overall analytics (`GET /results/analytics`)
  - Loads marking summary (`GET /marking/exams`)
  - Opens Marking Workbench
  - Bulk release/hide by filters via `POST /exams/{id}/toggle-results`
  - Displays compiled CA+Exam+CR rows for selected exam subject

Status: **Implemented**

### B) Marking Workbench
- File: `frontend/src/pages/admin/MarkingWorkbench.tsx`
- Route: `/admin/marking`
- Capabilities:
  - List exams requiring marking (`GET /marking/exams`)
  - List attempts per exam (`GET /marking/exams/{examId}/attempts`)
  - View attempt details + question-by-question responses (`GET /marking/attempts/{attemptId}`)
  - Score manual items (`POST /marking/attempts/{attemptId}/questions/{questionId}/score`)
  - Finalize attempt (`POST /marking/attempts/{attemptId}/finalize`)
  - Clear/reset attempt (`DELETE /marking/attempts/{attemptId}`)
  - Show session/security event summary

Status: **Implemented**

### C) Admin Settings (Grading + CR)
- File: `frontend/src/pages/admin/AdminSettings.tsx`
- Capabilities:
  - Grading scheme and scale settings
  - Pass-mark percentage setting
  - CR/Term settings (`current_term`, `current_academic_session`, weights, toggles)

Status: **Implemented**

## 3.2 Student

### A) My Results
- File: `frontend/src/pages/student/MyResults.tsx`
- Route: `/student/results`
- Capabilities:
  - Result rows from `GET /results/student/{studentId}`
  - Compiled CA/Exam and term breakdown rendering
  - Student stat tiles
  - PDF/Excel download from reports endpoints

Status: **Implemented**

---

## 4) Backend API Inventory

Primary route file: `backend/routes/api.php`

## 4.1 Result APIs
- `GET /results/student/{studentId}` → `Api\ResultController@getStudentResults`
- `GET /results/exam/{examId}` → `Api\ResultController@getExamResults`
- `GET /results/analytics` → `Api\ResultController@getAnalytics` (public route block)
- `GET /results/attempt/{attemptId}` → `Api\ResultController@getAttemptDetails`
- Reports:
  - `GET /reports/student/{studentId}/pdf`
  - `GET /reports/student/{studentId}/excel`

Status: **Implemented**

## 4.2 Marking APIs
- Guard: `role:Admin|Main Admin`
- Prefix: `/marking`
- Endpoints:
  - `GET /marking/exams`
  - `GET /marking/exams/{examId}/attempts`
  - `GET /marking/attempts/{attemptId}`
  - `POST /marking/attempts/{attemptId}/questions/{questionId}/score`
  - `POST /marking/attempts/{attemptId}/finalize`
  - `POST /marking/attempts/{attemptId}/force-submit`
  - `POST /marking/attempts/{attemptId}/extend-time`
  - `DELETE /marking/attempts/{attemptId}`

Status: **Implemented** (UI currently consumes all except `force-submit` and `extend-time`)

## 4.3 Result Visibility Control
- `POST /exams/{id}/toggle-results` → `Api\ExamController@toggleResultsVisibility`
- Updates `exams.results_released`

Status: **Implemented**

## 4.4 Legacy / Parallel Controllers
- `backend/app/Http/Controllers/ResultController.php` (legacy style with `released` statuses)
- `backend/app/Http/Controllers/CbtResultsController.php` (separate CBT pipeline)
- `backend/app/Http/Controllers/Api/ResultController.php` (current student/admin result endpoints)

Status: **Partially Consolidated** (multiple implementations exist)

---

## 5) Database Tables (Result/Marking Related)

## 5.1 Core Runtime & Scoring

1. `exam_attempts`
- Purpose: stores each exam sitting/attempt
- Key fields in use:
  - identity/linking: `attempt_uuid`, `exam_id`, `student_id`
  - lifecycle: `started_at`, `submitted_at`, `completed_at`, `status`
  - scoring: `score`, `assessment_mode`
  - runtime/security/sync: `question_order`, `switch_count`, `sync_status`, `sync_version`, `extra_time_minutes`

2. `student_answers`
- Purpose: answer rows per attempt-question
- Key fields in use:
  - `attempt_id`, `question_id`, `option_id`, `answer_text`
  - marking: `is_correct`, `marks_awarded`, `feedback`, `reviewed_by`, `reviewed_at`
  - review utility: `flagged`, `saved_at`

3. `exam_attempt_sessions`
- Purpose: session tracking per attempt (single-session enforcement support)

4. `exam_attempt_events`
- Purpose: security/activity events (tab hidden, blur, blocked actions, etc.)

5. `attempt_actions`
- Purpose: admin/system audit actions (result release toggle, reset, force submit, extend time)

Status (5.1): **Implemented**

## 5.2 Exam & Question Structure Impacting Results

6. `exams`
- Relevant fields:
  - `results_released`
  - `assessment_type`, `assessment_weight`
  - `academic_session`, `term`
  - scheduling/publish/status fields used by release flow

7. `exam_questions`
- Relevant fields:
  - `exam_id`, `bank_question_id`, `version_number`
  - `order_index`, `marks_override`

8. `question_options`
- Correct option references for objective auto-marking

Status (5.2): **Implemented**

## 5.3 Configuration Tables

9. `system_settings`
- Result/marking settings in use:
  - grading: `grading_scheme`, `grading_scale_waec`, `grading_scale_letter`, `position_grading_scale`, `pass_mark_percentage`
  - CR/term compilation: `current_academic_session`, `current_term`, `enable_term_result_compilation`, `enable_cumulative_results`, `default_ca_weight`, `default_exam_weight`, `use_exam_assessment_weight`

Status: **Implemented**

---

## 6) Marking Workbench Functional Coverage

## 6.1 Fully Covered
- Fetch exam queues for marking
- Prioritize submitted attempts
- Per-question manual scoring
- Auto/objective + manual combined score recalculation
- Finalization guard (cannot finalize if pending manual scores exist)
- Attempt reset/clear
- Security telemetry display in UI

## 6.2 Backend Covered, UI Missing
- Force submit (`POST /marking/attempts/{attemptId}/force-submit`)
- Extend time (`POST /marking/attempts/{attemptId}/extend-time`)

Status: **Partial**

---

## 7) Gaps / Risks Identified

1. **Result release enforcement gap**
- `results_released` is toggled, but `Api\ResultController@getStudentResults` does not filter by exam visibility.
- Impact: student results can be fetched regardless of release toggle (depending on client usage/access).

2. **Controller overlap**
- Legacy and current result controllers coexist with different assumptions/status models.
- Impact: long-term maintenance and debugging complexity.

3. **Route overlap risk**
- Multiple result analytics paths exist (`Api\ResultController` and `CbtResultsController`) under same route name pattern in route file.
- Impact: potential routing ambiguity and inconsistent payload expectations.

4. **Role scope of marking workbench**
- Marking endpoints are Admin/Main Admin only.
- Impact: if teachers should mark, authorization and UI policy update is required.

5. **No dedicated admin audit UI for attempt actions**
- `attempt_actions` logs are written but not surfaced in a focused result/marking audit screen.

---

## 8) Implementation Checklist (What remains)

## Priority 1 (Core correctness)
- [ ] Enforce `results_released` in student-visible result retrieval (`/results/student/{id}`) or gate by role.
- [ ] Add authorization checks so students can only fetch their own results unless admin/teacher role permits.

## Priority 2 (Workflow completeness)
- [ ] Expose `force-submit` and `extend-time` actions in `MarkingWorkbench` UI.
- [ ] Add confirmation + audit feedback in UI when these actions are used.

## Priority 3 (Architecture cleanup)
- [ ] Consolidate/retire legacy result controller paths not used by current UI.
- [ ] Resolve analytics route overlap to a single source of truth.

## Priority 4 (Operational visibility)
- [ ] Add admin-facing `attempt_actions` viewer/filter (exam, student, action type, date range).

---

## 9) Quick File Reference

### Frontend
- `frontend/src/pages/admin/ResultsAnalytics.tsx`
- `frontend/src/pages/admin/MarkingWorkbench.tsx`
- `frontend/src/pages/student/MyResults.tsx`
- `frontend/src/pages/admin/AdminSettings.tsx`
- `frontend/src/pages/AdminDashboard.tsx`

### Backend Controllers
- `backend/app/Http/Controllers/Api/MarkingController.php`
- `backend/app/Http/Controllers/Api/ResultController.php`
- `backend/app/Http/Controllers/Api/ExamController.php`
- `backend/app/Http/Controllers/CbtResultsController.php`
- `backend/app/Http/Controllers/ResultController.php` (legacy)

### Routes
- `backend/routes/api.php`

### Migrations (key)
- `backend/database/migrations/2025_11_25_000004_create_exam_attempts_and_answers.php`
- `backend/database/migrations/2026_02_12_000005_add_cbt_attempt_runtime_tables.php`
- `backend/database/migrations/2026_02_19_000014_add_mvp_offline_safety_columns.php`
- `backend/database/migrations/2025_12_22_add_assessment_fields_to_exams_table.php`
- `backend/database/migrations/2026_02_16_000010_add_term_session_to_exams_table.php`
- `backend/database/migrations/2026_02_16_000011_add_cumulative_result_settings.php`
- `backend/database/migrations/2026_02_15_000009_add_endpoint_and_grading_settings.php`

---

## 10) Bottom Line

Result Management and Marking Workbench are largely present and functional.  
Main remaining work is to close release/authorization correctness gaps, expose all existing marking operations in UI, and consolidate overlapping result pipelines.
