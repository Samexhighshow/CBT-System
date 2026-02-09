# CBT System - Quick Start Guide

## 🚀 Servers

### Start Backend
```powershell
cd C:\xampp\htdocs\CBT-System\backend
php artisan serve --host=127.0.0.1 --port=8000
```
**URL:** http://127.0.0.1:8000

### Start Frontend
```powershell
cd C:\xampp\htdocs\CBT-System\frontend
npm start
```
**URL:** http://localhost:3000

---

## 🔑 Default Login

**Admin:**
- Email: `admin@cbtsystem.local`
- Password: `admin123456`

---

## 📋 CSV Question Import

### 1. Download Template
```
GET http://127.0.0.1:8000/api/questions/template/download
```

### 2. Fill Template
```csv
question_text,question_type,marks,difficulty_level,option_1,option_2,option_3,option_4,correct_option
"What is 2+2?",multiple_choice,2,easy,"3","4","5","6",2
```

### 3. Upload
```
POST http://127.0.0.1:8000/api/questions/import
Form Data:
- file: [CSV/Excel file]
- exam_id: 1
- subject_id: 1
```

---

## 📊 Download Reports

### Exam Report (PDF)
```
http://127.0.0.1:8000/api/reports/exam/{examId}/pdf
```

### Exam Report (Excel)
```
http://127.0.0.1:8000/api/reports/exam/{examId}/excel
```

### Student Results (PDF)
```
http://127.0.0.1:8000/api/reports/student/{studentId}/pdf
```

### Student Results (Excel)
```
http://127.0.0.1:8000/api/reports/student/{studentId}/excel
```

---

## 📈 Analytics Endpoints

### Admin Dashboard
```
GET http://127.0.0.1:8000/api/analytics/admin/dashboard
```
Returns: total_students, total_exams, active_exams, performance_trend

### Student Dashboard
```
GET http://127.0.0.1:8000/api/analytics/student/{studentId}/dashboard
```
Returns: total_exams_taken, average_score, pass_rate, recent_results

### Performance Metrics
```
GET http://127.0.0.1:8000/api/analytics/performance?exam_id=1&start_date=2025-01-01
```

---

## 🎯 Main Features

### ✅ Completed
- Full TypeScript frontend (100%)
- 8 Laravel controllers (100%)
- 51 API endpoints
- CSV import/export
- PDF/Excel reports
- Analytics dashboard
- Full viewport login pages
- Footer credits (Maximus + MAVIS)

### 📁 Key Files
```
Backend Controllers:
├── StudentController.php (9 methods)
├── ExamController.php (9 methods)
├── QuestionController.php (10 methods - CSV)
├── SubjectController.php (5 methods)
├── DepartmentController.php (5 methods)
├── ResultController.php (4 methods)
├── AnalyticsController.php (5 methods)
└── ReportController.php (5 methods - PDF/Excel)

Frontend Pages:
├── AdminDashboard.tsx (6 modules)
├── StudentDashboard.tsx (6 modules)
├── QuestionBank.tsx (CSV upload ready)
├── StudentLogin.tsx (full viewport ✓)
├── AdminLogin.tsx (full viewport ✓)
├── StudentRegistration.tsx (full viewport ✓)
└── LandingPage.tsx (credits ✓)
```

---

## 🎨 Credits (Footer)

**Idea and Lead:** Maximus
**Contributor:** MAVIS (yellow-blue gradient)

---

## 🔄 Test API with Postman/Thunder Client

**Base URL:** `http://127.0.0.1:8000/api`

**Example Requests:**

1. **Get All Students**
   ```
   GET /api/students
   ```

2. **Create Exam**
   ```
   POST /api/exams
   Body: {
     "title": "Math Test",
     "subject_id": 1,
     "duration_minutes": 60,
     "total_marks": 100,
     "passing_marks": 50,
     "start_time": "2025-06-01 09:00:00",
     "end_time": "2025-06-01 12:00:00",
     "status": "published",
     "department_ids": [1, 2]
   }
   ```

3. **Start Exam**
   ```
   POST /api/exams/1/start
   Body: {
     "student_id": 1
   }
   ```

4. **Get Dashboard Stats**
   ```
   GET /api/analytics/admin/dashboard
   ```

---

## 📖 Documentation

- API Routes: 51 endpoints (run `php artisan route:list --path=api`)
- Database: MySQL (cbt_system)
- Tables: 12+ tables with relationships
- Seeders: Admin user, subjects, departments, sample exams

---

## ✨ What's New

1. **Full Backend Implementation**
   - All controllers with CRUD
   - CSV import/export
   - PDF/Excel reports
   - Analytics system

2. **UI Improvements**
   - Login pages now full viewport
   - Footer credits added
   - Gradient text for MAVIS

3. **Production Ready**
   - Both servers running
   - All routes working
   - TypeScript compilation successful
   - Zero errors

---

## 📞 Support

Check `BACKEND_IMPLEMENTATION.md` for detailed documentation.
Check `IMPLEMENTATION_COMPLETE_FINAL.md` for full summary.
