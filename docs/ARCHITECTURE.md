# CBT System - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Student Devices                         │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   Web Browser    │  │  Offline Storage (IndexedDB)     │ │
│  │  (React PWA)     │  │  - Exams                         │ │
│  │  ┌────────────┐  │  │  - Questions                     │ │
│  │  │ Student UI │  │  │  - Answers                       │ │
│  │  │ Admin UI   │  │  │  - Attempts                      │ │
│  │  └────────────┘  │  └──────────────────────────────────┘ │
│  └──────────────────┘                                        │
└────────────┬──────────────────────────────────────────────────┘
             │ HTTP/HTTPS
             │ (Online/Offline)
┌────────────▼──────────────────────────────────────────────────┐
│                      Web Server                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Node.js + Express API                       │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │  Routes                                              ││ │
│  │  │  - /api/auth        (JWT authentication)            ││ │
│  │  │  - /api/students    (Registration, profile)         ││ │
│  │  │  - /api/exams       (Exam management)               ││ │
│  │  │  - /api/exam-attempts (Answer submission)           ││ │
│  │  │  - /api/subjects    (Subject management)            ││ │
│  │  │  - /api/departments (Department management)         ││ │
│  │  │  - /api/admins      (Admin management)              ││ │
│  │  │  - /api/reports     (Analytics & export)            ││ │
│  │  └─────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────┬──────────────────────────────────────────────────┘
             │ SQL
             │
┌────────────▼──────────────────────────────────────────────────┐
│                       MySQL Database                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Tables:                                                 │ │
│  │  - admins                 - exams                        │ │
│  │  - students               - exam_questions              │ │
│  │  - subjects               - exam_attempts               │ │
│  │  - departments            - student_answers             │ │
│  │  - trade_subjects         - registration_windows        │ │
│  │  - student_subjects                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React PWA)

```
App.js (Main Router)
├── Pages/
│   ├── StudentRegistration
│   │   ├── Form Component
│   │   ├── Subject Selector
│   │   └── Department Selector
│   ├── StudentLogin
│   ├── StudentDashboard
│   │   ├── Profile Section
│   │   ├── Exam List
│   │   └── Results List
│   ├── ExamPortal
│   │   ├── Question Viewer
│   │   ├── Answer Saver
│   │   ├── Timer
│   │   └── Question Navigator
│   ├── AdminLogin
│   └── AdminDashboard
│       ├── Dashboard Stats
│       ├── Student Management
│       ├── Exam Management
│       ├── Subject Management
│       └── Reports
├── Services/
│   ├── api.js (Axios REST client)
│   └── offlineDB.js (IndexedDB wrapper)
├── Store/
│   ├── authStore (User state)
│   ├── examStore (Exam state)
│   └── answerStore (Answer state)
└── Utils/
    ├── helpers.js
    ├── validators.js
    └── constants.js
```

### Backend (Node.js/Express)

```
src/index.js (Entry Point)
├── Routes/
│   ├── auth.routes.js
│   ├── student.routes.js
│   ├── exam.routes.js
│   ├── subject.routes.js
│   ├── department.routes.js
│   ├── admin.routes.js
│   ├── examAttempt.routes.js
│   └── report.routes.js
├── Controllers/
│   ├── auth.controller.js
│   ├── student.controller.js
│   ├── exam.controller.js
│   ├── subject.controller.js
│   ├── department.controller.js
│   ├── admin.controller.js
│   ├── examAttempt.controller.js
│   └── report.controller.js
├── Middleware/
│   ├── auth.middleware.js (JWT validation)
│   └── validation.middleware.js (Input validation)
├── Models/
│   ├── Student (TODO)
│   ├── Exam (TODO)
│   └── etc.
├── Utils/
│   ├── logger.js (Winston)
│   ├── helpers.js
│   └── constants.js
└── config/
    └── database.js (MySQL connection)
```

## Data Flow - Student Registration

```
1. Student visits /register
   ↓
2. Frontend checks registration window (API call)
   ↓
3. Student fills form with:
   - Personal info
   - Class level
   - Department (if SSS)
   - Trade subjects (if SSS)
   ↓
4. Frontend validates input (client-side)
   ↓
5. POST /api/students/register
   ├─ Validation (server-side)
   ├─ Check registration window open
   ├─ Hash password
   ├─ Generate Student ID
   ├─ Assign subjects based on:
   │  ├─ Class level
   │  ├─ Department
   │  ├─ Trade subjects
   │  └─ Subject compulsory/optional flags
   └─ Save to database
   ↓
6. Return Student ID
   ↓
7. Frontend redirects to login with Student ID
   ↓
8. Student completes registration ✓
```

## Data Flow - Exam Taking (with Offline Support)

```
1. Student clicks "Take Exam"
   ↓
2. ExamPortal loads
   ├─ GET /api/exams/{examId} (get exam details)
   ├─ GET /api/exams/{examId}/questions/{studentId} (get questions)
   └─ Save to IndexedDB
   ↓
3. POST /api/exam-attempts/start/{examId}
   ├─ Create attempt record
   ├─ Return attempt ID
   └─ Start timer
   ↓
4. Student answers questions
   ├─ Every answer auto-saved to:
   │  ├─ IndexedDB (always)
   │  └─ Server POST /api/exam-attempts/{attemptId}/save-answer (if online)
   ├─ If offline: answers queued for sync
   └─ UI shows save status
   ↓
5. Student submits exam
   ├─ If online:
   │  ├─ POST /api/exam-attempts/{attemptId}/submit
   │  ├─ Server calculates score
   │  ├─ Returns result
   │  └─ Student sees score
   └─ If offline:
      ├─ Mark attempt as submitted in IndexedDB
      ├─ Queue for sync
      └─ Show "Pending sync" message
   ↓
6. When internet returns:
   ├─ Sync queue processes
   ├─ Upload answers to server
   └─ Server marks as synced
   ↓
7. Exam complete ✓
```

## Data Flow - Admin Result Release

```
1. Admin logs in
   ↓
2. POST /api/auth/admin/login (JWT token returned)
   ↓
3. Admin navigates to Reports/Exams
   ↓
4. GET /api/exams (fetch all exams)
   ↓
5. Admin selects exam and clicks "Release Results"
   ↓
6. PUT /api/exams/{examId}/release-results
   ├─ Update exam.is_results_released = TRUE
   ├─ Set released_at timestamp
   └─ Return success
   ↓
7. Student sees results on next dashboard load
   ├─ GET /api/students/results
   └─ Shows released results
   ↓
8. Admin can export results:
   ├─ GET /api/reports/export/results?format=csv
   └─ Download CSV file
   ↓
9. Complete ✓
```

## Authentication Flow

```
┌──────────────────────────────────────────────────────┐
│             User Login (Admin or Student)             │
└────────────┬─────────────────────────────────────────┘
             │
             ↓
    ┌────────────────────┐
    │ POST /api/auth/    │
    │ admin/login or     │
    │ student/login      │
    └────────┬───────────┘
             │
             ├─ Validate credentials
             ├─ Hash password check
             └─ Generate tokens
             │
             ↓
    ┌────────────────────────────────────┐
    │ Return:                            │
    │ - accessToken (expires in 7 days)  │
    │ - refreshToken                     │
    │ - user object                      │
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │ Frontend stores tokens in localStorage
    │ and sends on each request:         │
    │ Authorization: Bearer {token}      │
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │ Backend middleware validates:       │
    │ 1. Token exists                    │
    │ 2. Token signature valid           │
    │ 3. Token not expired               │
    │ 4. User has required role          │
    └────────┬───────────────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │ If valid: Proceed to route handler │
    │ If invalid: Return 401 Unauthorized│
    └────────────────────────────────────┘

If token expires:
    │
    ↓
POST /api/auth/refresh-token
├─ Send refreshToken
├─ Validate refreshToken
└─ Return new accessToken
```

## Database Schema Relationships

```
admins
├── creates → exams
└── creates → registration_windows

departments
├── has many → department_subjects
│   └── references → subjects
├── has many → department_trade_subjects
│   └── references → trade_subjects
└── has many → students

students
├── registered in → registration_window (period)
├── has department → departments
├── has many → student_subjects
│   ├── references → subjects
│   └── marks compulsory/optional/trade
├── has many → student_exams
│   └── references → exams
└── has many → exam_attempts

exams
├── contains → exam_questions
│   └── has many → question_options
├── assigned to → student_exams (many-to-many)
└── has many → exam_attempts

exam_attempts
├── references → students
├── references → exams
└── has many → student_answers
    └── references → exam_questions & question_options
```

## Caching Strategy

### Frontend Caching (IndexedDB)
- **What**: Exams, questions, answers
- **When**: On exam page load
- **Why**: Offline support
- **Invalidation**: Manual clear or on app update

### Backend Caching (TODO)
- **What**: Subject lists, departments, registration windows
- **When**: On first request
- **Duration**: 1 hour
- **Invalidation**: On admin update

## Error Handling

### Client-side
```
User Action
├─ Input Validation
│  └─ Show form errors
├─ API Call
│  ├─ Network error: Show "offline" message
│  ├─ 400/422: Show validation errors
│  ├─ 401: Redirect to login
│  ├─ 403: Show "access denied"
│  ├─ 500: Show error notification
│  └─ Retry logic with exponential backoff
└─ Success: Update UI
```

### Server-side
```
Request
├─ Auth validation (middleware)
├─ Input validation (Joi schemas)
├─ Business logic
│  └─ Database operations
├─ Error handling
│  ├─ Log to Winston
│  ├─ Return appropriate HTTP status
│  └─ Send error message
└─ Response
```

## Scalability Considerations

### Current Limitations
- Single MySQL instance
- Session stored in memory (no persistence)
- No load balancing
- IndexedDB limited to ~50MB per domain

### For Production Scale-up

1. **Database**
   - Add MySQL replication
   - Implement read replicas
   - Add caching layer (Redis)

2. **Backend**
   - Horizontal scaling with load balancer (nginx)
   - Multiple Node.js instances
   - Session store in Redis

3. **Frontend**
   - CDN for static assets
   - Service worker for better offline
   - Increase IndexedDB storage

4. **Monitoring**
   - Add APM (New Relic, DataDog)
   - Centralized logging (ELK stack)
   - Health checks and alerts

---

**Architecture Version**: 1.0.0
