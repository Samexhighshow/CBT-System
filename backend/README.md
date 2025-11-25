# CBT System - Laravel Backend (Scaffold)

This folder contains a scaffold for the Laravel backend for the CBT System. It provides placeholder composer.json and skeleton PHP classes (models, controllers, migrations and services) so you can run `composer install` and continue development.

Quick start (Windows / XAMPP):

1. Ensure PHP CLI and Composer are in PATH (or use XAMPP php.exe path):
   - Example: `C:\xampp\php\php.exe` and `C:\xampp\php\composer.phar`
2. From this folder run:

```powershell
cd "C:\xampp\htdocs\CBT System\backend"
# If using XAMPP PHP binary explicitly
& 'C:\\xampp\\php\\php.exe' -r "copy('https://getcomposer.org/installer','composer-setup.php');"
& 'C:\\xampp\\php\\php.exe' composer-setup.php
& 'C:\\xampp\\php\\php.exe' -r "unlink('composer-setup.php');"
& 'C:\\xampp\\php\\composer.phar' install
```

3. Copy `.env.example` to `.env` and update DB credentials.
4. Run vendor publishes and migrations after editing migration files and creating DB:

```powershell
& 'C:\\xampp\\php\\php.exe' artisan key:generate
& 'C:\\xampp\\php\\php.exe' artisan vendor:publish --provider="Spatie\\Permission\\PermissionServiceProvider"
& 'C:\\xampp\\php\\php.exe' artisan migrate
```

Notes:
- This scaffold does not run Composer for you; it provides the PHP files and a `composer.json` for the Laravel dependencies. Run Composer locally to install the framework packages.
- After Composer install, you can finish wiring middleware, auth providers, and update controllers to your needs.
