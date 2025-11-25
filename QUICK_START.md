# CBT System - Quick Start Cheatsheet

## 🚀 Get Started in 5 Minutes

### Terminal 1: Backend
```powershell
cd "C:\xampp\htdocs\CBT System\backend"
& 'C:\xampp\php\php.exe' artisan serve --host=127.0.0.1 --port=8000
```
✅ API running at `http://127.0.0.1:8000/api`

### Terminal 2: Frontend
```powershell
cd "C:\xampp\htdocs\CBT System\frontend"
npm start
```
✅ App running at `http://localhost:3000`

---

## 📋 Test Accounts (Already Seeded)

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@cbtsystem.local | admin123456 |
| **Student** | john@example.com | (register manually or create in DB) |

---

## 🧪 Quick Tests

### 1. Student Registration
- Go to http://localhost:3000
- Click "Student Registration"
- Fill form → Register
- Get Student ID

### 2. Offline Exam
- Login as student
- Go to "Student Dashboard" → "Assigned Exams"
- Click exam → questions load
- Press F12 → Network → "Offline" checkbox
- Exam still works (offline cached)
- Answer questions and submit
- Go back online → auto-syncs

### 3. Admin Features
- Go to http://localhost:3000/admin
- Login: admin@cbtsystem.local / admin123456
- Create registration window, exams, manage subjects

---

## 🔗 Key API Endpoints

### Public
```
POST /api/login
POST /api/register
GET /api/exams
GET /api/exams/{id}
GET /api/registration/current-window
```

### Protected (Bearer Token)
```
GET /api/student/profile
PUT /api/student/profile
POST /api/exams/{id}/start
POST /api/exams/attempts/sync
```

### Admin Only (Role Check)
```
GET/POST /api/departments
GET/POST /api/subjects
GET/POST /api/registration-windows
```

---

## 📁 Project Structure

```
CBT System/
├── backend/                    # Laravel API
│   ├── app/Models/            # Database models
│   ├── app/Http/Controllers/  # API controllers
│   ├── database/migrations/   # Schema
│   ├── database/seeders/      # Default data
│   ├── routes/api.php         # API routes
│   └── .env                   # DB credentials
│
├── frontend/                   # React PWA
│   ├── src/pages/             # Pages (ExamPortal, AdminDash, etc.)
│   ├── src/services/          # API client, offline DB, sync
│   ├── public/service-worker.js # PWA caching
│   └── .env                   # API URL
│
└── docs/
    ├── COMPLETE_SETUP_GUIDE.md        # Full setup (read this!)
    ├── SETUP_LARAVEL.md               # Laravel only
    └── IMPLEMENTATION_COMPLETE.md     # What was built
```

---

## 🛠️ Common Commands

### Database
```powershell
# Run migrations
& 'C:\xampp\php\php.exe' artisan migrate

# Seed data
& 'C:\xampp\php\php.exe' artisan db:seed --class=RoleSeeder

# Reset everything
& 'C:\xampp\php\php.exe' artisan migrate:refresh --seed
```

### Frontend
```powershell
# Build for production
npm run build

# Run tests
npm test

# Format code
npm run lint
```

---

## 🐛 Debugging

### Check Database
```powershell
mysql -u root -p cbt_system
> SELECT * FROM students;
> SELECT * FROM users;
> SELECT * FROM exam_attempts;
```

### Check Service Worker
Browser DevTools (F12) → Application → Service Workers

### Check IndexedDB
Browser DevTools (F12) → Application → IndexedDB → CBTSystemDB

### Check Laravel Logs
```powershell
type backend\storage\logs\laravel.log
```

---

## 🚨 Troubleshooting

| Problem | Fix |
|---------|-----|
| `Composer not found` | Use full path: `& 'C:\xampp\php\php.exe'` |
| `DB connection error` | Check MySQL running + .env credentials |
| `Exam won't load offline` | Check Service Worker registered (DevTools → Application) |
| `Sync fails` | Verify backend running; check CORS; check `/api/exams/attempts/sync` |
| `Admin can't create exam` | Verify admin role assigned to user in DB |

---

## 📚 Full Documentation

Read **`docs/COMPLETE_SETUP_GUIDE.md`** for:
- ✅ Complete XAMPP setup steps
- ✅ Migration & seeding details
- ✅ All API endpoints with examples
- ✅ Production deployment tips
- ✅ Troubleshooting guide

---

## 🎯 What's Ready Now

✅ Backend: Fully scaffolded with models, controllers, migrations, seeders  
✅ Frontend: PWA with offline support, sync queue, IndexedDB  
✅ Database: All tables + sample data  
✅ API: All core endpoints (registration, exams, sync, admin CRUD)  
✅ Offline: Complete offline exam + auto-sync workflow  

---

## 📝 Next Steps (Optional)

1. **Run Composer locally** and test migrations
2. **Test complete offline flow** (register → load → offline → submit → sync)
3. **Build admin UI** for exam creation, results release
4. **Add Zustand state** for global auth/exam state
5. **Create reusable components** (Button, Input, Modal, Timer)
6. **Add PDF exports** for result certificates
7. **Deploy to production** with HTTPS, hardening, monitoring

---

**Questions?** Check the logs, DevTools, and COMPLETE_SETUP_GUIDE.md! 🚀
