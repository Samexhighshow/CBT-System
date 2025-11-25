# Laravel + React PWA CBT System - Complete XAMPP Setup & Deployment Guide

This guide covers the complete setup for the CBT System on Windows using XAMPP for local development.

## System Requirements

- **PHP**: 8.1+ (XAMPP provides this)
- **MySQL**: 5.7+ or MariaDB (XAMPP provides this)
- **Node.js**: 16+ (for React frontend)
- **Composer**: Latest (https://getcomposer.org)
- **PowerShell**: Windows PowerShell 5.1+
- **XAMPP**: 7.4+ (https://www.apachefriends.org)

## Part 1: Database Setup

1. **Start XAMPP**: Open XAMPP Control Panel and start Apache and MySQL.

2. **Create Database**:
   ```powershell
   mysql -u root -p -e "CREATE DATABASE cbt_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```
   Leave password blank if prompted (default XAMPP setup).

3. **Verify Connection**:
   ```powershell
   mysql -u root -p -e "SHOW DATABASES;"
   ```

## Part 2: Backend Setup (Laravel)

1. **Install Composer Dependencies**:
   ```powershell
   cd "C:\xampp\htdocs\CBT System\backend"
   composer install
   ```
   If composer is not in PATH, use the full path:
   ```powershell
   & 'C:\xampp\php\php.exe' 'C:\xampp\php\composer.phar' install
   ```

2. **Configure Environment**:
   ```powershell
   copy .env.example .env
   code .env  # Open in VS Code to edit
   ```
   Update these in `.env`:
   ```
   APP_KEY=  # Will generate below
   
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=cbt_system
   DB_USERNAME=root
   DB_PASSWORD=  # Leave blank for XAMPP default
   ```

3. **Generate App Key and Publish Vendor Packages**:
   ```powershell
   & 'C:\xampp\php\php.exe' artisan key:generate
   & 'C:\xampp\php\php.exe' artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
   & 'C:\xampp\php\php.exe' artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
   ```

4. **Run Migrations**:
   ```powershell
   & 'C:\xampp\php\php.exe' artisan migrate
   ```
   **Expected Output**: Migration tables created (users, students, exams, etc.)

5. **Seed Roles, Admin, and Sample Data**:
   ```powershell
   & 'C:\xampp\php\php.exe' artisan db:seed --class=RoleSeeder
   & 'C:\xampp\php\php.exe' artisan db:seed --class=AdminSeeder
   & 'C:\xampp\php\php.exe' artisan db:seed --class=SubjectDepartmentSeeder
   & 'C:\xampp\php\php.exe' artisan db:seed --class=ExamSeeder
   ```

6. **Start Laravel Server**:
   ```powershell
   & 'C:\xampp\php\php.exe' artisan serve --host=127.0.0.1 --port=8000
   ```
   **Expected**: "Laravel development server started at http://127.0.0.1:8000"

## Part 3: Frontend Setup (React PWA)

1. **Install Node Dependencies**:
   ```powershell
   cd "C:\xampp\htdocs\CBT System\frontend"
   npm install
   ```

2. **Configure Environment**:
   ```powershell
   copy .env.example .env
   code .env  # Edit if needed
   ```
   Ensure:
   ```
   REACT_APP_API_URL=http://127.0.0.1:8000/api
   ```

3. **Start React Development Server**:
   ```powershell
   npm start
   ```
   **Expected**: React app opens at http://localhost:3000

## Part 4: Testing the System

### Test Student Registration (Online)

1. Go to http://localhost:3000 → "Student Registration"
2. Fill in the form:
   - First Name: John
   - Last Name: Doe
   - Email: john@example.com
   - Phone: 08012345678
   - Class Level: JSS1
3. Click "Register"
4. **Expected**: Success message with student ID

### Test Exam Load & Offline Mode

1. Student Login: john@example.com (no password requirement initially)
2. Go to "Assigned Exams"
3. **With Internet**: Click exam → questions load and cache
4. **Simulate Offline**: In DevTools (F12) → Network tab → check "Offline"
5. Click exam again → questions load from IndexedDB (should still work)
6. Take exam offline, submit → queued locally
7. **Go Online**: Answers sync to backend automatically

### Test Admin Features

1. Admin Login: admin@cbtsystem.local / admin123456
2. Go to Admin Dashboard
3. **Manage Registration Windows**: Open/close registration
4. **Manage Subjects**: Add/edit subjects per department
5. **Create Exam**: Add exam, add questions, publish
6. **Release Results**: After students submit, admin can release

## Part 5: API Endpoints Quick Reference

### Authentication
- `POST /api/login` → Login with email/password
- `POST /api/register` → Student registration (checks registration window)

### Exams (Public)
- `GET /api/exams` → List published exams
- `GET /api/exams/{id}` → Load exam with questions (cached PWA)

### Student (Protected)
- `GET /api/student/profile` → Get logged-in student profile
- `PUT /api/student/profile` → Update student info

### Admin (Protected, Role-based)
- `GET /api/departments` → List departments
- `POST /api/departments` → Create department (Admin only)
- `GET /api/subjects?class_level=JSS` → List subjects by class
- `GET /api/registration-windows` → List registration windows
- `POST /api/registration-windows` → Create registration window (Admin only)

### Sync
- `POST /api/exams/attempts/sync` → Sync offline exam attempt (idempotent)

## Part 6: Key Files & Architecture

### Backend Structure
```
backend/
├── app/
│   ├── Models/           # Eloquent models
│   ├── Http/
│   │   ├── Controllers/  # API controllers
│   │   └── Middleware/   # Auth, RBAC, validation
│   └── Services/         # Business logic (ExamScoringService)
├── database/
│   ├── migrations/       # Table structures
│   └── seeders/          # Default roles, admin, sample data
├── routes/
│   └── api.php           # API route definitions
└── .env                  # Database credentials
```

### Frontend Structure
```
frontend/
├── src/
│   ├── pages/            # React pages (ExamPortal, Admin, etc.)
│   ├── services/
│   │   ├── laravelApi.js # Axios client for Laravel
│   │   ├── offlineDB.js  # Dexie IndexedDB wrapper
│   │   └── offlineSync.js # Offline sync queue logic
│   └── App.js            # Router
├── public/
│   └── service-worker.js # PWA caching strategy
└── .env                  # API URL
```

## Part 7: Troubleshooting

| Issue | Solution |
|-------|----------|
| PHP command not found | Use full path: `& 'C:\xampp\php\php.exe'` |
| Database connection error | Verify MySQL running: XAMPP Control Panel → Start MySQL |
| Migration fails | Ensure `.env` has correct DB credentials; check DB exists |
| Exam won't load offline | Ensure Service Worker registered; check IndexedDB in DevTools |
| Sync fails | Check backend running; verify `/api/exams/attempts/sync` is accessible |
| Admin can't create exam | Verify admin user has role and permissions (check `roles` table) |

## Part 8: Production Deployment Considerations

Before going live:

1. **Security**:
   - Use HTTPS (SSL certificate)
   - Enable CORS properly (not localhost in prod)
   - Implement rate limiting on auth endpoints
   - Hash passwords with bcrypt (already handled by Laravel)

2. **Performance**:
   - Optimize DB indices (already added in migrations)
   - Use Redis for session caching (optional)
   - Enable query caching

3. **Monitoring**:
   - Log all sync attempts and errors
   - Monitor offline queue for stuck items
   - Track exam submission anomalies

4. **Backup**:
   - Regular MySQL backups
   - Git commits for code

## Part 9: Next Steps

1. **Add state management**: Implement Zustand for global auth/exam state
2. **Create reusable UI**: Button, Input, Modal, Timer components
3. **Admin dashboard enhancements**: Rich CRUD UIs for exams/questions
4. **PDF export**: Use dompdf for result certificates
5. **Advanced analytics**: Dashboard with charts and statistics

## Support

For issues:
1. Check Laravel logs: `storage/logs/laravel.log`
2. Check browser console: F12 → Console tab
3. Check IndexedDB: F12 → Application → IndexedDB → CBTSystemDB
4. Test API directly: Postman or curl

---

**Last Updated**: November 25, 2025
