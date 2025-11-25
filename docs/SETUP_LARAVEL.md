# Laravel Backend Setup (Windows / XAMPP)

This document explains how to install and run the Laravel backend scaffold included in the repository. It assumes you choose the recommended stack: Laravel + Sanctum + spatie/laravel-permission.

Prerequisites
- PHP 8.1+ (XAMPP provides PHP CLI)
- Composer (https://getcomposer.org)
- MySQL (XAMPP's MariaDB)
- Node.js (for frontend build if needed)

Steps
1. Open PowerShell as Administrator.
2. Create the database in phpMyAdmin or via CLI:

```powershell
mysql -u root -p -e "CREATE DATABASE cbt_system;"
```

3. Install composer dependencies (use XAMPP php if necessary):

```powershell
cd "C:\xampp\htdocs\CBT System\backend"
# If composer is in PATH
composer install
# If you need to invoke XAMPP PHP explicitly
& 'C:\\xampp\\php\\php.exe' 'C:\\xampp\\php\\composer.phar' install
```

4. Copy `.env.example` to `.env` and update DB credentials.

```powershell
copy .env.example .env
# Edit .env in VS Code or Notepad
code .env
```

5. Generate app key and publish vendor packages:

```powershell
& 'C:\\xampp\\php\\php.exe' artisan key:generate
& 'C:\\xampp\\php\\php.exe' artisan vendor:publish --provider="Spatie\\Permission\\PermissionServiceProvider"
& 'C:\\xampp\\php\\php.exe' artisan vendor:publish --provider="Laravel\\Sanctum\\SanctumServiceProvider"
```

6. Run migrations:

```powershell
& 'C:\\xampp\\php\\php.exe' artisan migrate
```

7. Seed default roles and an admin (you will create seeders in `database/seeders`):

```powershell
& 'C:\\xampp\\php\\php.exe' artisan db:seed --class=RoleSeeder
```

8. Run the app (dev):

```powershell
& 'C:\\xampp\\php\\php.exe' artisan serve --host=127.0.0.1 --port=8000
```

Next steps
- Implement remaining migrations and seeders included in the `backend/database/migrations` and `backend/database/seeders` folders.
- Wire up authentication, middleware, and policies.
- Update the React frontend to point at `http://127.0.0.1:8000/api` and test the offline sync flow.
