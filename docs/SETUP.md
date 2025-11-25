# CBT System - Setup Guide

Complete step-by-step setup instructions for the CBT System.

## Prerequisites

Before starting, ensure you have:
- **Node.js** 16+ ([Download](https://nodejs.org))
- **MySQL** 8.0+ ([Download](https://dev.mysql.com/downloads/mysql))
- **Git** ([Download](https://git-scm.com))
- **Code Editor** (VS Code recommended)

## Windows Setup

### 1. Start MySQL Server

```powershell
# If using XAMPP
# Open XAMPP Control Panel and click Start on MySQL

# Or, if MySQL is installed as a service
net start MySQL80
```

### 2. Create Database

```powershell
# Connect to MySQL
mysql -u root -p

# In MySQL prompt
CREATE DATABASE cbt_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cbt_system;

# Import schema
source "C:\path\to\CBT System\database\schema.sql";

# Exit
EXIT;
```

### 3. Backend Setup

```powershell
# Navigate to backend
cd "C:\xampp\htdocs\CBT System\backend"

# Install dependencies
npm install

# Create .env file
Copy-Item .env.example -Destination .env

# Edit .env with your details (use Notepad)
notepad .env
```

Update `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cbt_system
JWT_SECRET=your_secret_key_12345
FRONTEND_URL=http://localhost:3000
```

Start backend:
```powershell
npm run dev
```

Backend will run on: **http://localhost:5000**

### 4. Frontend Setup

Open a new terminal:

```powershell
# Navigate to frontend
cd "C:\xampp\htdocs\CBT System\frontend"

# Install dependencies
npm install

# Create .env file
$content = "REACT_APP_API_URL=http://localhost:5000/api"
$content | Out-File -Encoding UTF8 .env

# Start development server
npm start
```

Frontend will open at: **http://localhost:3000**

## 🎯 First Steps After Setup

### 1. Create Admin User

In MySQL:
```sql
USE cbt_system;

-- Hash password: admin123 with bcrypt
INSERT INTO admins (id, email, password_hash, first_name, last_name, role, is_active)
VALUES ('admin-001', 'admin@school.com', '$2a$10$...', 'System', 'Admin', 'super_admin', TRUE);
```

Or use backend API endpoint to create admin.

### 2. Add Subjects

Admin creates subjects:
- Mathematics
- English Language
- Sciences
- Social Studies
- etc.

### 3. Setup Departments (for SSS)

Admin creates departments:
- Science
- Commercial
- Arts

And assigns subjects to each department.

### 4. Create Registration Window

Admin sets registration period:
- Start date: e.g., 2025-11-25 08:00:00
- End date: e.g., 2025-11-30 17:00:00
- Class level: JSS or SSS

### 5. Test Student Registration

Visit: **http://localhost:3000/register**

Fill in registration form and submit.

### 6. Create Exam

Admin creates exam:
- Subject
- Class level
- Questions (with options for MCQ)
- Duration
- Total marks

### 7. Test Student Exam

Student logs in, takes exam, submit answers.

## 📦 Production Deployment

### Backend Deployment

1. **Build and package:**
```bash
cd backend
npm run build  # If applicable
```

2. **Deploy to cloud** (Heroku, AWS, DigitalOcean, etc.)
   - Set environment variables on hosting platform
   - Configure database URL
   - Set NODE_ENV=production

3. **Example Heroku deployment:**
```bash
heroku create cbt-system-api
heroku config:set DB_HOST=your_db_host
heroku config:set JWT_SECRET=your_production_secret
git push heroku main
```

### Frontend Deployment

1. **Build for production:**
```bash
cd frontend
npm run build
```

2. **Deploy static files** (Netlify, Vercel, GitHub Pages, etc.)
   - Upload `build/` folder
   - Set environment variables

3. **Example Netlify deployment:**
   - Connect GitHub repository
   - Set build command: `npm run build`
   - Set publish directory: `build`

## 🔒 Production Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS on all URLs
- [ ] Configure CORS to trusted origins only
- [ ] Use environment variables for secrets
- [ ] Enable database backups
- [ ] Set up error logging and monitoring
- [ ] Implement rate limiting
- [ ] Enable SQL query logging for audit
- [ ] Use database connection pooling
- [ ] Implement session timeout
- [ ] Enable two-factor authentication (optional)

## 🚨 Troubleshooting

### MySQL Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solution:**
- Start MySQL service
- Check credentials in `.env`
- Verify database exists

### Port 5000 Already in Use
```
Error: listen EADDRINUSE :::5000
```

**Solution:**
```powershell
# Find process using port 5000
Get-NetTCPConnection -LocalPort 5000

# Kill process
Stop-Process -Id <PID> -Force
```

### CORS Error in Browser
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
- Update `FRONTEND_URL` in backend `.env`
- Update `REACT_APP_API_URL` in frontend `.env`
- Restart both servers

### Module Not Found
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
npm install
```

### Service Worker Issues
**Clear browser cache:**
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data"
4. Restart browser

## 📞 Support

For issues:
1. Check error logs in console
2. Review database error logs
3. Check browser console (F12)
4. Review backend logs in terminal

---

**Setup completed successfully!** 🎉

Next: Read API.md for endpoint documentation.
