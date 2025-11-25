# CBT System - Complete Implementation Summary

## Project Overview

A comprehensive Computer-Based Testing (CBT) system for Nigerian schools (JSS/SSS), designed to operate **almost entirely offline** with automatic syncing when internet becomes available. Built with **Laravel 10 + React 18 + Sanctum + Zustand + Service Workers + IndexedDB**.

### Key Features
- ✅ Full offline capability (exams downloadable, questions answerable offline)
- ✅ Automatic sync on reconnection with idempotency guarantees
- ✅ Multi-role RBAC (Admin, Sub-Admin, Moderator, Teacher, Student)
- ✅ Flexible subject management (JSS compulsory vs SSS department-based)
- ✅ Admin-controlled registration windows
- ✅ Real-time exam scoring
- ✅ CSV export reports for analytics
- ✅ PWA-ready with Service Worker caching

---

## Architecture Summary

### Backend (Laravel 10)

**Location**: `c:\xampp\htdocs\CBT System\backend\`

#### Models (10 total)
- `User` (with Sanctum tokens, multi-role support)
- `Student` (auto-assigned subjects based on class level)
- `Exam` (with questions relation)
- `Question` (MCQ/text/essay with options)
- `Option` (for MCQ questions)
- `ExamAttempt` (tracks student attempts with attempt_uuid for idempotency)
- `StudentAnswer` (stores answers per question)
- `Department` (JSS/SSS departments for subject grouping)
- `Subject` (with class_level and compulsory flag)
- `RegistrationWindow` (with isOpen() helper)

#### Controllers (10 total)
1. **AuthController** - Login/logout with Sanctum token
2. **StudentController** - Register (with registration window validation), profile, auto-subject assignment
3. **ExamController** - List published exams, load exam with questions/options, start exam
4. **ExamSyncController** - POST `/api/exams/attempts/sync` with idempotency (attempt_uuid validation)
5. **DepartmentController** - CRUD departments (Admin/Sub-Admin)
6. **SubjectController** - CRUD subjects by class level (Admin/Sub-Admin)
7. **RegistrationWindowController** - CRUD registration windows (Admin/Sub-Admin)
8. **ExamManagementController** - Create, update, publish exams; add questions with options (Admin/Sub-Admin/Teacher)
9. **ResultController** - Release results, fetch results by student/exam, get analytics
10. **ReportExportController** - CSV exports (students list, exams, results, departments, analytics)

#### Migrations (6 total)
1. `users` - with roles_table (spatie)
2. `students` - with student_id (S + uniqid), department_id, class_level
3. `exams_and_questions` - exams, questions, options tables with foreign keys
4. `exam_attempts_and_answers` - attempts with attempt_uuid, answers with student_answer content
5. `departments_and_subjects` - departments, subjects, trade_subjects, pivot tables
6. `registration_windows` - with start_at, end_at, isOpen scope

#### Routes (25+ endpoints)
```
POST   /login
POST   /register
GET    /registration/current-window
GET    /exams (public, published)
GET    /exams/{id} (public, with questions/options)

[Protected - Sanctum Bearer token]
POST   /exams/{id}/start
POST   /exams/attempts/sync
GET    /student/profile
PUT    /student/profile
GET    /student/results

[Admin/Sub-Admin]
CRUD   /departments, /subjects, /registration-windows
POST   /exams
PUT    /exams/{id}, /exams/{id}/publish
POST   /exams/{id}/questions
DELETE /exams/{id}
POST   /exams/{id}/release-results
GET    /exams/{id}/results
GET    /export/{students,exams,results,departments,analytics}
```

#### Services
- **ExamScoringService** - Auto-calculates score based on MCQ correct answers
- **Seeders** - RoleSeeder, AdminSeeder, SubjectDepartmentSeeder, ExamSeeder with realistic data

---

### Frontend (React 18)

**Location**: `c:\xampp\htdocs\CBT System\frontend\src\`

#### State Management (Zustand)
1. **`store/authStore.js`**
   - `user`, `token`, `loading`, `error`
   - Methods: `login()`, `register()`, `logout()`, `hasRole()`, `hasPermission()`
   - Persists token/user to localStorage

2. **`store/examStore.js`**
   - `exams`, `currentExam`, `currentAttempt`, `answers`, `timeRemaining`, `isOffline`
   - Methods: `fetchExams()`, `loadExam()`, `startExam()`, `saveAnswer()`, `submitExam()`, `syncAttempts()`
   - Handles offline/online detection and queuing

#### Components (7 reusable)
- **Button** - variants (primary/secondary/danger/success/outline), sizes (sm/md/lg), loading state
- **Input** - with label, error display, disabled state
- **Modal** - dialog with confirm/cancel buttons, size variants
- **Card** - container with title/subtitle, clickable option
- **Alert** - types (success/error/warning/info) with icon and close button
- **Timer** - countdown display with progress bar, color warnings
- **Loading** - spinner with optional full-screen overlay

#### Pages (updated)
1. **StudentRegistration** - Form with registration window validation, auto-subject display
2. **StudentLogin** - Email/password login with token storage
3. **StudentDashboard** - View assigned exams, past results, pending syncs
4. **ExamPortal** (completely rewritten)
   - Loads exam from Laravel API (fallback to IndexedDB)
   - Detects online/offline status with event listeners
   - Timer with auto-submit
   - Question navigator sidebar
   - Auto-saves answers to IndexedDB
   - On submit: queues attempt via offlineSync, syncs if online
   - Displays sync status feedback
5. **AdminLogin** - Admin authentication
6. **AdminDashboard** (completely rewritten with Zustand)
   - Tabs: Overview (stats cards), Exams (table with edit), Students (registered list)
   - Departments (grid view), Subjects (grid view), Windows (grid view)
   - Reports (CSV export buttons)
   - Modals for CRUD operations

#### Services
1. **`services/laravelApi.js`**
   - Axios client with baseURL: `http://127.0.0.1:8000/api`
   - Sanctum Bearer token interceptor (reads from localStorage['auth_token'])
   - Exports: `auth.login()`, `auth.register()`, `exams.list()`, `exams.load()`, `exams.start()`, `exams.syncAttempt()`

2. **`services/offlineDB.js`**
   - Dexie wrapper for IndexedDB
   - Stores: exams, questions, options, student answers
   - Methods: `saveExam()`, `getExam()`, `saveAnswer()`, `getAnswers()`

3. **`services/offlineSync.js`**
   - Manages sync queue in localStorage (key: `cbt_sync_queue`)
   - Device ID tracking (key: `cbt_device_id`) with UUID generation
   - Methods:
     - `queueAttempt()` - saves to IndexedDB + queue
     - `getSyncQueue()` - retrieves pending attempts
     - `syncAttempt()` - POSTs to API, removes from queue
     - `syncAll()` - syncs all queued attempts
     - `hasPendingAttempts()` - checks for unsynced data
   - Idempotency via `attempt_uuid` (client-generated, validated unique on server)
   - Integrity via `answers_hash` (SHA256 base64)

#### PWA Setup
- Service Worker (cache-first for assets, network-first for API)
- Manifest.json with app metadata
- Offline indicator in ExamPortal UI

---

## Data Flow Diagrams

### Student Registration Flow
```
1. Student navigates to /register
2. Frontend checks GET /registration/current-window
3. If window.isOpen():
   - Form displayed
   - Student enters email, name, class_level, department (if SSS)
4. POST /register validates:
   - Email unique
   - Registration window open
   - Class level valid (JSS/SSS)
5. Server auto-assigns subjects:
   - JSS: all compulsory JSS subjects
   - SSS: department compulsory + optional subjects
6. StudentID generated: "S" + uniqid()
7. Token issued (Sanctum)
```

### Exam Taking Flow (Offline-First)
```
1. Student loads ExamPortal with examId
2. Frontend GET /exams/{id} (public, no auth)
   - On success: save to IndexedDB + render
   - On error: load from IndexedDB (if cached)
3. Student selects answers (MCQ) or types (text/essay)
   - Auto-save to IndexedDB on each selection
4. Timer counts down (exam.duration_minutes * 60)
   - On timeout: auto-submit
5. On submit:
   - Generate attempt_uuid (uuidv4)
   - Generate answers_hash (SHA256 base64 of answers JSON)
   - Get device_id (persistent UUID)
   - Queue attempt: { exam_id, answers, attempt_uuid, answers_hash, device_id }
6. Check online status:
   - If online: POST /exams/attempts/sync immediately
     - Server validates attempt_uuid uniqueness + answers_hash
     - ExamScoringService calculates score
     - Return score + synced_at timestamp
   - If offline: Store in queue, show "Pending Sync" badge
7. When online: automatic sync via offlineSync.syncAll()
   - Retries queued attempts
   - Removes from queue on success
```

### Admin Exam Management Flow
```
1. Admin POST /exams with title, class_level, duration_minutes
   - Server validates (Admin/Sub-Admin role)
   - Creates exam in draft (published=false)
2. Admin POST /exams/{id}/questions with question_type, text, options
   - For MCQ: validates options array with is_correct flag
   - Creates Question + Option records
3. Admin PUT /exams/{id}/publish to mark published=true
4. Published exam shows in GET /exams (student-visible)
5. Students can load and take exam
6. Admin GET /exams/{id}/results to view analytics
7. Admin POST /exams/{id}/release-results to make scores visible to students
8. Admin GET /export/results downloads CSV with all attempt data
```

---

## Security Highlights

1. **Authentication**: Sanctum Bearer tokens (stateless, no sessions)
2. **Authorization**: spatie/laravel-permission with multi-role support
3. **Idempotency**: attempt_uuid prevents duplicate submissions
4. **Integrity**: answers_hash validation on sync
5. **Device Tracking**: device_id for offline device identification
6. **Registration Window**: Enforced server-side (immutable)

**Todo (Not Yet Implemented)**:
- HTTPS/SSL for production
- Rate limiting on API endpoints
- CORS policy enforcement
- Token blacklist for logout
- Secrets management (.env validation)

---

## Database Schema

### Users Table
- id, name, email, password, created_at, updated_at

### Students Table
- id, user_id (FK), student_id (unique), first_name, last_name, email, class_level, department_id (FK, nullable), created_at, updated_at

### Exams Table
- id, title, description (nullable), class_level, duration_minutes, published, created_at, updated_at

### Questions Table
- id, exam_id (FK), question_type (mcq/text/essay), text, order, metadata (JSON, nullable), created_at, updated_at

### Options Table
- id, question_id (FK), text, is_correct (default false), order, created_at, updated_at

### ExamAttempts Table
- id, exam_id (FK), student_id (FK), attempt_uuid (unique), answers_hash, device_id, score (nullable), status (attempted/scored/released), synced_at, started_at, ended_at, created_at, updated_at

### StudentAnswers Table
- id, attempt_id (FK), question_id (FK), content (JSON - stores selected option or text), created_at, updated_at

### Departments Table
- id, name, description, class_level (JSS/SSS), is_active, created_at, updated_at

### Subjects Table
- id, department_id (FK, nullable), name, class_level, is_compulsory, created_at, updated_at

### TradeSubjects Table
- id, department_id (FK), subject_id (FK), created_at, updated_at

### RegistrationWindows Table
- id, name, start_at, end_at, is_active, created_at, updated_at

---

## Environment Setup

### Backend (.env)
```env
APP_NAME=CBTSystem
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cbt_system
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=127.0.0.1:3000,localhost:3000
SESSION_DOMAIN=127.0.0.1
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://127.0.0.1:8000/api
REACT_APP_OFFLINE_ENABLED=true
```

---

## Seeded Data

### Roles (5 total)
1. Admin - full system access
2. Sub-Admin - can manage exams, departments, subjects, windows
3. Moderator - can view reports, moderate content
4. Teacher - can view exams, students, answer sheets
5. Student - can register, take exams, view results

### Users
- **Admin**: admin@cbtsystem.local / admin123456
- **Teacher**: teacher@cbtsystem.local / teacher123456 (role: Teacher)

### Subjects
**JSS (All Compulsory)**:
- English Language
- Mathematics
- Integrated Science
- Social Studies
- ICT
- Civic Education
- Physical Education

**SSS Science**:
- Physics (compulsory)
- Chemistry (compulsory)
- Biology (compulsory)

**SSS Arts**:
- Literature in English (compulsory)
- History (compulsory)
- Geography (compulsory)

**SSS Commercial**:
- Economics (compulsory)
- Accounting (compulsory)
- Commerce (compulsory)

### Sample Exams
- JSS Final Exam (20 questions, MCQ)
- SSS Biology Mock (30 questions, mixed types)

---

## File Inventory (Backend)

```
backend/
├── app/
│   ├── Models/ (10 models)
│   ├── Http/
│   │   ├── Controllers/ (10 controllers)
│   │   └── Middleware/ (EnsureRegistrationOpen, CheckRole)
│   └── Services/ (ExamScoringService)
├── database/
│   ├── migrations/ (6 migrations)
│   └── seeders/ (4 seeders)
├── routes/
│   └── api.php (25+ endpoints)
├── .env.example
└── composer.json
```

## File Inventory (Frontend)

```
frontend/
├── src/
│   ├── pages/
│   │   ├── StudentRegistration.js
│   │   ├── StudentLogin.js
│   │   ├── StudentDashboard.js
│   │   ├── ExamPortal.js (completely rewritten)
│   │   ├── AdminLogin.js
│   │   └── AdminDashboard.js (completely rewritten)
│   ├── components/
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── Modal.js
│   │   ├── Card.js
│   │   ├── Alert.js
│   │   ├── Timer.js
│   │   ├── Loading.js
│   │   └── index.js
│   ├── store/
│   │   ├── authStore.js (Zustand)
│   │   └── examStore.js (Zustand)
│   ├── services/
│   │   ├── laravelApi.js (axios + Sanctum)
│   │   ├── offlineDB.js (Dexie)
│   │   └── offlineSync.js (queue management)
│   ├── App.js (routing)
│   └── index.js
├── public/
│   ├── service-worker.js (cache-first strategy)
│   └── manifest.json (PWA metadata)
├── package.json (React, axios, dexie, zustand)
└── .env.local (API_URL)
```

---

## Testing Checklist

- [ ] Student registration with registration window validation
- [ ] Student login and Sanctum token issuance
- [ ] Exam load (online and offline with IndexedDB)
- [ ] Answer submission (MCQ selection, text entry, essay)
- [ ] Auto-save to IndexedDB on each answer
- [ ] Online sync (POST /exams/attempts/sync with idempotency)
- [ ] Offline mode (queue attempt, show "pending")
- [ ] Automatic sync on reconnection
- [ ] Score calculation and display
- [ ] Admin exam CRUD
- [ ] Admin department/subject management
- [ ] Admin registration window management
- [ ] CSV export reports
- [ ] Result release visibility
- [ ] Multi-role RBAC enforcement
- [ ] Service Worker caching
- [ ] Session persistence

---

## Quick Start (Development)

### Backend
```powershell
cd backend
composer install
php artisan migrate --seed
php artisan serve  # http://127.0.0.1:8000
```

### Frontend
```powershell
cd frontend
npm install
npm start  # http://localhost:3000
```

### Admin Login
- Email: admin@cbtsystem.local
- Password: admin123456

### Student Registration
- Use current registration window
- JSS assignment is automatic
- SSS assignment requires department selection

---

## Remaining TODOs

1. **Production Hardening** (Env validation, SSL, rate limiting, token blacklist)
2. **Integration Testing** (Test all flows end-to-end)
3. **Performance Optimization** (Pagination for large datasets, image compression)
4. **Error Handling** (Better error messages, retry logic)
5. **Mobile App** (React Native wrapper for PWA)

---

## Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Laravel | 10 |
| Auth | Sanctum | Latest |
| RBAC | spatie/laravel-permission | Latest |
| Frontend | React | 18 |
| State | Zustand | Latest |
| HTTP | Axios | Latest |
| Offline DB | Dexie | Latest |
| Styling | Tailwind CSS | 3 |
| Icons | Heroicons | Latest |
| PWA | Service Worker | Native |

---

## Contact & Support

For issues or questions, refer to:
- COMPLETE_SETUP_GUIDE.md (Windows/XAMPP setup)
- QUICK_START.md (5-minute reference)
- API.md (endpoint documentation)

---

**Project Status**: ✅ Phase 1 Complete (Core System)
**Next Phase**: Production Hardening & Testing
