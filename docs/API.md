# CBT System - API Quick Reference

Base URL: `http://localhost:5000/api`

All requests require `Content-Type: application/json` (except file uploads).

Protected routes require: `Authorization: Bearer {token}`

## Authentication Endpoints

### Admin Login
```http
POST /auth/admin/login
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "password123"
}

Response 200:
{
  "token": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "admin-001",
    "email": "admin@school.com",
    "role": "super_admin"
  }
}
```

### Student Login
```http
POST /auth/student/login

{
  "studentId": "STU-123456",
  "password": "password123"
}

Response 200:
{
  "token": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "student-uuid",
    "studentId": "STU-123456",
    "name": "John Doe",
    "classLevel": "SSS1"
  }
}
```

### Refresh Token
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}

Response 200:
{
  "token": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Logout
```http
POST /auth/logout
Authorization: Bearer {token}

Response 200:
{
  "message": "Logged out successfully"
}
```

---

## Student Endpoints

### Check Registration Status
```http
GET /students/registration-status

Response 200:
{
  "registrationOpen": true,
  "windows": [
    {
      "id": "window-001",
      "name": "JSS Registration 2025",
      "class_level": "JSS",
      "start_date": "2025-11-25T08:00:00",
      "end_date": "2025-11-30T17:00:00"
    }
  ]
}
```

### Student Registration
```http
POST /students/register

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@school.com",
  "phone": "08012345678",
  "gender": "M",
  "dateOfBirth": "2010-05-15",
  "classLevel": "SSS1",
  "departmentId": "dept-science",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}

Response 201:
{
  "studentId": "STU-1734067200000",
  "message": "Registration successful"
}
```

### Get Profile
```http
GET /students/profile
Authorization: Bearer {token}

Response 200:
{
  "id": "student-uuid",
  "student_id": "STU-123456",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@school.com",
  "class_level": "SSS1",
  "department_id": "dept-science",
  "registration_date": "2025-11-25T10:30:00"
}
```

### Update Profile
```http
PUT /students/profile
Authorization: Bearer {token}

{
  "email": "john.doe@school.com",
  "phone": "08098765432"
}

Response 200:
{
  "message": "Profile updated successfully"
}
```

### Get Assigned Exams
```http
GET /students/assigned-exams
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "exam-001",
    "title": "Mathematics Q1",
    "subject_id": "subj-math",
    "class_level": "SSS1",
    "duration_minutes": 120,
    "total_questions": 50,
    "total_marks": 100,
    "start_time": "2025-12-01T10:00:00",
    "end_time": "2025-12-01T12:00:00"
  }
]
```

### Get Results
```http
GET /students/results
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "attempt-001",
    "exam_title": "Mathematics Q1",
    "subject_name": "Mathematics",
    "total_marks_obtained": 78,
    "percentage": 78.0,
    "submit_time": "2025-12-01T12:00:00",
    "is_results_released": true
  }
]
```

---

## Exam Endpoints

### Create Exam (Admin)
```http
POST /exams
Authorization: Bearer {token}

{
  "title": "Mathematics Q1",
  "subjectId": "subj-math",
  "classLevel": "SSS1",
  "departmentId": "dept-science",
  "description": "First quarter examination",
  "totalQuestions": 50,
  "totalMarks": 100,
  "durationMinutes": 120,
  "passMark": 40,
  "startTime": "2025-12-01T10:00:00",
  "endTime": "2025-12-01T12:00:00"
}

Response 201:
{
  "id": "exam-001",
  "message": "Exam created successfully"
}
```

### List Exams (Admin)
```http
GET /exams?classLevel=SSS1&subjectId=subj-math
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "exam-001",
    "title": "Mathematics Q1",
    "subject_name": "Mathematics",
    "class_level": "SSS1",
    "total_questions": 50,
    "total_marks": 100,
    "start_time": "2025-12-01T10:00:00",
    "is_results_released": false
  }
]
```

### Get Exam Details
```http
GET /exams/exam-001
Authorization: Bearer {token}

Response 200:
{
  "id": "exam-001",
  "title": "Mathematics Q1",
  "description": "First quarter examination",
  "duration_minutes": 120,
  "total_marks": 100,
  "pass_mark": 40,
  "total_questions": 50
}
```

### Get Available Exams (Public)
```http
GET /exams/available/student-uuid

Response 200:
[
  {
    "id": "exam-001",
    "title": "Mathematics Q1",
    "subject_name": "Mathematics",
    "start_time": "2025-12-01T10:00:00",
    "end_time": "2025-12-01T12:00:00",
    "duration_minutes": 120
  }
]
```

### Get Exam Questions
```http
GET /exams/exam-001/questions/student-uuid
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "q-001",
    "question_text": "What is 2+2?",
    "question_type": "MCQ",
    "marks": 1,
    "options": [
      {
        "id": "opt-1",
        "option_text": "4",
        "option_key": "A"
      },
      {
        "id": "opt-2",
        "option_text": "5",
        "option_key": "B"
      }
    ]
  }
]
```

### Release Results (Admin)
```http
PUT /exams/exam-001/release-results
Authorization: Bearer {token}

Response 200:
{
  "message": "Results released successfully"
}
```

---

## Exam Attempt Endpoints

### Start Exam
```http
POST /exam-attempts/start/exam-001
Authorization: Bearer {token}

{
  "attemptId": null
}

Response 201:
{
  "attemptId": "attempt-uuid",
  "message": "Exam started"
}
```

### Save Answer
```http
POST /exam-attempts/attempt-uuid/save-answer
Authorization: Bearer {token}

{
  "questionId": "q-001",
  "selectedOptionId": "opt-1",
  "answerText": null
}

Response 200:
{
  "message": "Answer saved"
}
```

### Submit Exam
```http
POST /exam-attempts/attempt-uuid/submit
Authorization: Bearer {token}

Response 200:
{
  "message": "Exam submitted successfully",
  "totalMarks": 78,
  "percentage": "78.00"
}
```

### Get Attempt
```http
GET /exam-attempts/attempt-uuid
Authorization: Bearer {token}

Response 200:
{
  "id": "attempt-uuid",
  "student_id": "student-uuid",
  "exam_id": "exam-001",
  "start_time": "2025-12-01T10:00:00",
  "submit_time": "2025-12-01T12:00:00",
  "total_marks_obtained": 78,
  "percentage": 78.0,
  "status": "submitted"
}
```

---

## Subject Endpoints

### Create Subject (Admin)
```http
POST /subjects
Authorization: Bearer {token}

{
  "name": "Mathematics",
  "code": "MATH",
  "description": "Mathematics subject",
  "appliesToClass": "BOTH",
  "isCompulsory": true,
  "totalQuestions": 50,
  "timeDurationMinutes": 120
}

Response 201:
{
  "id": "subj-math",
  "message": "Subject created successfully"
}
```

### List Subjects
```http
GET /subjects?classLevel=SSS&compulsoryOnly=false

Response 200:
[
  {
    "id": "subj-math",
    "name": "Mathematics",
    "code": "MATH",
    "applies_to_class": "BOTH",
    "is_compulsory": true
  }
]
```

---

## Department Endpoints

### Create Department (Admin)
```http
POST /departments
Authorization: Bearer {token}

{
  "name": "Science",
  "code": "SCI",
  "description": "Science department",
  "appliesToClass": "SSS"
}

Response 201:
{
  "id": "dept-science",
  "message": "Department created successfully"
}
```

### List Departments
```http
GET /departments?appliesToClass=SSS

Response 200:
[
  {
    "id": "dept-science",
    "name": "Science",
    "code": "SCI",
    "applies_to_class": "SSS"
  }
]
```

### Add Subject to Department (Admin)
```http
POST /departments/dept-science/subjects
Authorization: Bearer {token}

{
  "subjectId": "subj-math",
  "isCompulsory": true
}

Response 201:
{
  "id": "dept-subj-001",
  "message": "Subject added to department"
}
```

---

## Admin Endpoints

### Get Dashboard (Admin)
```http
GET /admins/dashboard
Authorization: Bearer {token}

Response 200:
{
  "totalStudents": 150,
  "totalExams": 24,
  "totalSubmitted": 3600,
  "timestamp": "2025-11-25T15:30:00"
}
```

### List Students (Admin)
```http
GET /admins/students?classLevel=SSS1&search=john
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "student-uuid",
    "student_id": "STU-123456",
    "first_name": "John",
    "last_name": "Doe",
    "class_level": "SSS1",
    "email": "john@school.com"
  }
]
```

---

## Report Endpoints

### Export Students (CSV)
```http
GET /reports/export/students
Authorization: Bearer {token}

Response: CSV file download
```

### Export Results (CSV)
```http
GET /reports/export/results
Authorization: Bearer {token}

Response: CSV file download
```

### Get Results Report
```http
GET /reports/results?classLevel=SSS1&departmentId=dept-science
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "attempt-001",
    "student_id": "STU-123456",
    "student_name": "John Doe",
    "exam_title": "Mathematics Q1",
    "total_marks_obtained": 78,
    "percentage": 78.0,
    "submit_time": "2025-12-01T12:00:00"
  }
]
```

---

## Common Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Error Response Format

```json
{
  "error": "Description of what went wrong",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

**API Documentation v1.0**
