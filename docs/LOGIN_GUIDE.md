# CBT System - Login Credentials Guide

## Current Status
✅ **Backend:** Running on http://localhost:8000  
✅ **Frontend:** Running on http://localhost:3000  
✅ **Database:** Seeded with admin users

---

## Admin Login Credentials

### Option 1: Seeded Admin (ID=2)
- **URL:** http://localhost:3000/admin-login
- **Email:** `admin@cbtsystem.local`
- **Password:** `admin123456`
- **Status:** ✅ Verified, Admin role assigned

### Option 2: Existing Admin (ID=1)
- **URL:** http://localhost:3000/admin-login
- **Email:** `isholasamuel062@gmail.com`
- **Password:** (you should know this password)
- **Status:** ✅ Verified, Admin role assigned

---

## What Was Fixed

1. **Email Verification Issue**
   - Updated `AdminSeeder.php` to mark admin as verified (`email_verified_at`)
   - Re-ran seeder to backfill verification for existing admin

2. **Frontend API Configuration**
   - Created `frontend/.env` with `REACT_APP_API_URL=http://localhost:8000/api`
   - Restarted frontend to pick up new environment variable

3. **Multiple Admin Users**
   - Found that ID=1 (`isholasamuel062@gmail.com`) already existed
   - ID=2 (`admin@cbtsystem.local`) was seeded with correct verification

---

## Login Flow Requirements

### For Admin Login to Succeed:
1. ✅ Email must exist in `users` table
2. ✅ Password must match (hashed with bcrypt)
3. ✅ `email_verified_at` must NOT be null
4. ✅ User must have a role assigned (`Admin`, `Teacher`, etc.)
5. ✅ Backend must be running on `http://localhost:8000`
6. ✅ Frontend must have correct `REACT_APP_API_URL` in `.env`

### Login Endpoint:
```
POST http://localhost:8000/api/auth/login
Content-Type: application/json

{
  "email": "admin@cbtsystem.local",
  "password": "admin123456"
}
```

**Response (Success):**
```json
{
  "token": "1|xxxxx...",
  "user": {
    "id": 2,
    "email": "admin@cbtsystem.local",
    "name": "Administrator",
    "roles": [{"name": "Admin"}]
  }
}
```

---

## How to Add More Admin Users

### Method 1: Via Seeder
```bash
cd backend
php artisan db:seed --class=AdminSeeder
```

### Method 2: Via Admin Signup (Frontend)
1. Go to http://localhost:3000/admin/signup
2. Fill name, email, password
3. Main Admin must approve and assign role

### Method 3: Via Database Script
```bash
cd backend
php artisan tinker

>>> $user = App\Models\User::create([
...   'name' => 'New Admin',
...   'email' => 'newadmin@test.com',
...   'password' => Hash::make('password123'),
...   'email_verified_at' => now()
... ]);
>>> $user->assignRole('Admin');
```

---

## Troubleshooting Login Failures

### Error: "Invalid credentials"
- Check email/password spelling
- Verify user exists: `php scripts/list_users.php`
- Test password: `php scripts/check_admin.php`

### Error: "Please verify your email"
- Run: `php artisan db:seed --class=AdminSeeder` to verify existing admin
- Or manually update: `UPDATE users SET email_verified_at = NOW() WHERE email = 'your@email.com';`

### Error: Network/CORS issues
- Ensure backend is running: http://localhost:8000
- Check `frontend/.env` has: `REACT_APP_API_URL=http://localhost:8000/api`
- Check `backend/.env` has: `SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000`
- Restart both servers after .env changes

### Error: "Login failed. Please check your credentials."
- Check browser console (F12) for actual error
- May be CORS, network, or API response issue
- Test API directly: `Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/auth/login -ContentType 'application/json' -Body '{"email":"admin@cbtsystem.local","password":"admin123456"}' | ConvertTo-Json`

---

## Quick Commands Reference

### Start Servers
```powershell
# Backend (Terminal 1)
cd "c:\xampp\htdocs\CBT-System\backend"
php artisan serve

# Frontend (Terminal 2)
cd "c:\xampp\htdocs\CBT-System\frontend"
npm run dev
```

### Check Users
```powershell
cd "c:\xampp\htdocs\CBT-System\backend"
php scripts\list_users.php
```

### Verify Admin
```powershell
cd "c:\xampp\htdocs\CBT-System\backend"
php scripts\check_admin.php
```

### Reset Admin Password
```powershell
cd "c:\xampp\htdocs\CBT-System\backend"
php artisan tinker

>>> $user = App\Models\User::where('email', 'admin@cbtsystem.local')->first();
>>> $user->password = Hash::make('newpassword123');
>>> $user->save();
```

---

## Next Steps

1. ✅ **Both servers running**
2. ✅ **Admin credentials verified**
3. 🎯 **Open http://localhost:3000/admin-login**
4. 🎯 **Login with either admin account**
5. 🎯 **You should see the admin dashboard**

If login still fails, check the browser console (F12 → Network tab) to see the actual API error.
