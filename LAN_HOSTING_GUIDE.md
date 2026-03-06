# CBT System - LAN Server Hosting Guide

## Overview

This guide explains how to host the CBT System on a Local Area Network (LAN) with a central server architecture, allowing multiple client devices (students, teachers, admins) to connect and use the system without affecting network load or requiring internet connectivity.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HUB SERVER (Central)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Main Server (Physical Machine)              │  │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │  │
│  │  │  Laravel API    │  │    MySQL Database        │   │  │
│  │  │  (Port 8000)    │  │  (Port 3306)             │   │  │
│  │  └─────────────────┘  └──────────────────────────┘   │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Node.js Express Sync Server (Optional)         │  │  │
│  │  │  - Handles offline sync (Port 5000)            │  │  │
│  │  │  - Manages student data sync                   │  │  │
│  │  │  - Processes exam attempts                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────┘
               │ LAN Network (Ethernet/WiFi)
    ┌──────────┼──────────┬──────────┬──────────┐
    │          │          │          │          │
┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
│Client│  │Client│  │Client│  │Client│  │Client│
│  PC1 │  │  PC2 │  │  PC3 │  │  PC4 │  │  PC5 │
│React │  │React │  │React │  │React │  │React │
│PWA   │  │PWA   │  │PWA   │  │PWA   │  │PWA   │
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘
```

### Key Components

1. **HUB/Main Server**: Central Laravel API + MySQL Database
2. **Client Devices**: Student/Teacher/Admin devices with React PWA
3. **LAN Network**: Direct network connection (no internet required)
4. **Offline Capability**: Student exams can work offline and sync when online

---

## Hardware & Network Requirements

### Server Machine (HUB)

- **OS**: Windows Server 2019+ / Linux (Ubuntu 20.04+) / XAMPP Stack
- **Processor**: Minimum Intel i5 (recommend i7/Ryzen 7)
- **RAM**: 8GB minimum (16GB recommended for 50+ concurrent users)
- **Storage**: 256GB SSD (exam data, logs, backups)
- **Network Card**: Gigabit Ethernet (1GB/s recommended)
- **Backup Power**: UPS (uninterruptible power supply)

### Client Devices

- **OS**: Windows 7+ / macOS / Linux / iOS / Android
- **Browser**: Chrome, Firefox, Edge, Safari (modern versions)
- **RAM**: 2GB minimum
- **Network**: WiFi or Ethernet connection to LAN

### Network Infrastructure

- **Router**: Gigabit Ethernet with 802.11ac WiFi (for wireless clients)
- **Cabling**: Cat6 or Cat6A for main server to new router
- **Network Architecture**:
  - All devices on same subnet (e.g., 192.168.1.x)
  - No firewall blocking ports 3306, 5000, 8000
  - DHCP or Static IP assignment

---

## Step-by-Step Setup (Windows + XAMPP)

### 1. Prepare Server Hardware

```
Choose a dedicated machine to be the HUB Server:
- Keep it powered on 24/7 or scheduled for exam periods
- Position near router/network switch for best connectivity
- Use wired Ethernet connection (not WiFi) for stability
- Monitor CPU/RAM usage to ensure capacity
```

### 2. Install XAMPP Stack

```powershell
# Download XAMPP for Windows: https://www.apachefriends.org/
# Choose PHP 8.2+ version

# Default installation path: C:\xampp

# Post-installation, verify services:
cd C:\xampp\php
php -v                          # Check PHP version
.\php.exe -m | Select-String mysql    # Verify MySQL PHP extension
```

### 3. Copy Project to Server

```powershell
# Copy entire CBT-System folder to server
# Recommended location: C:\xampp\htdocs\cbt-system
# Or: D:\projects\cbt-system (if separate drive for better performance)

cp -r "C:\Users\Michris\CBT-System\backend" "C:\xampp\htdocs\cbt-system\backend"
cp -r "C:\Users\Michris\CBT-System\frontend" "C:\xampp\htdocs\cbt-system\frontend"
```

### 4. Configure Backend (.env)

**File**: `C:\xampp\htdocs\cbt-system\backend\.env`

```ini
# Application
APP_NAME=CBT_System
APP_ENV=production              # or 'local' for development
APP_KEY=your_generated_key      # Run: php artisan key:generate
APP_DEBUG=false                 # NEVER true in production
APP_URL=http://192.168.1.100    # Replace with your server's STATIC IP

# Database (Local on same machine)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cbt_system
DB_USERNAME=root                # XAMPP default
DB_PASSWORD=                     # XAMPP default (empty)

# Server Configuration
PORT=8000                        # Laravel API port
API_URL=http://192.168.1.100:8000

# Frontend URL (for CORS)
FRONTEND_URL=http://192.168.1.100:3000

# Sanctum (API Authentication)
SANCTUM_STATEFUL_DOMAINS=192.168.1.100
SESSION_DOMAIN=192.168.1.100

# Optional: Node.js Sync Server
NODEJS_SYNC_SERVER=http://192.168.1.100:5000
```

**⚠️ CRITICAL**: Set `APP_URL` and `DB_HOST` to your **server's static LAN IP** (not localhost)

### 5. Configure Frontend (.env)

**File**: `C:\xampp\htdocs\cbt-system\frontend\.env`

```ini
REACT_APP_API_URL=http://192.168.1.100:8000/api
REACT_APP_OFFLINE_ENABLED=true
REACT_APP_SYNC_ENABLED=true
```

### 6. Database Setup

```powershell
# Start XAMPP services (Apache & MySQL)
# Via XAMPP Control Panel or:
cd C:\xampp
.\mysql\bin\mysqld.exe              # Start MySQL

# In another terminal, run migrations:
cd C:\xampp\htdocs\cbt-system\backend
php artisan migrate
php artisan seed:run                # If seeders are ready
```

### 7. Start Services

**Option A: Development Mode (One-time)**

```powershell
# Terminal 1 - Start Laravel (Backend API)
cd C:\xampp\htdocs\cbt-system\backend
php artisan serve --host 192.168.1.100 --port 8000

# Terminal 2 - Start React Dev Server
cd C:\xampp\htdocs\cbt-system\frontend
npm install
npm start                  # Starts on http://192.168.1.100:3000
```

**Option B: Production Mode (Recommended for Server)**

```powershell
# Use XAMPP Apache to serve both

# 1. Enable Apache modules
# 2. Configure Virtual Hosts in C:\xampp\apache\conf\extra\httpd-vhosts.conf

# 3. Build React for production
cd C:\xampp\htdocs\cbt-system\frontend
npm run build               # Creates build/ folder (static files)

# 4. Copy frontend build to Laravel public folder
Copy-Item "C:\xampp\htdocs\cbt-system\frontend\build\*" ^
    "C:\xampp\htdocs\cbt-system\backend\public\frontend" -Recurse

# 5. Start Apache via XAMPP Control Panel
```

---

## Network Configuration

### Setting Static IP for Server

**Windows (XAMPP Server Machine)**:

```powershell
# Via GUI:
# Settings > Network & Internet > Ethernet > Properties
# > Edit > IP Assignment > Manual
# Set: 192.168.1.100, Subnet: 255.255.255.0, Gateway: 192.168.1.1

# Via PowerShell (Admin):
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.1.100 `
    -PrefixLength 24 -DefaultGateway 192.168.1.1
```

### Firewall Rules (Allow LAN Access)

```powershell
# Windows Firewall - Allow inbound on ports 3306, 5000, 8000
New-NetFirewallRule -DisplayName "CBT MySQL" -Direction Inbound `
    -LocalPort 3306 -Protocol TCP -Action Allow

New-NetFirewallRule -DisplayName "CBT API" -Direction Inbound `
    -LocalPort 8000 -Protocol TCP -Action Allow

New-NetFirewallRule -DisplayName "CBT Sync" -Direction Inbound `
    -LocalPort 5000 -Protocol TCP -Action Allow
```

### Client Device Setup

**For each student/teacher/admin device**:

1. Connect to LAN (Ethernet or WiFi)
2. Open browser
3. Navigate to: `http://192.168.1.100:3000` (or your server IP)
4. Login with credentials

---

## Optimization for Multiple Users (50+)

### 1. Increase Database Connections

**File**: `C:\xampp\mysql\bin\my.ini`

```ini
[mysqld]
max_connections=500              # Default 151
max_allowed_packet=256M
innodb_buffer_pool_size=4G       # Allocate based on RAM
```

### 2. Configure PHP-FPM (if using instead of mod_php)

**File**: `C:\xampp\php\etc\php-fpm.conf`

```ini
[www]
pm = dynamic
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
```

### 3. Optimize Laravel Configuration

**File**: `backend\.env`

```ini
CACHE_DRIVER=redis              # Use Redis if available
SESSION_DRIVER=redis
QUEUE_DRIVER=redis
DB_CONNECTION_POOL=20           # Connection pooling
```

### 4. Load Balancing (Optional - for very large deployments)

If exceeded capacity, use **Nginx/HAProxy** to load balance:

```
                    ┌──────────────┐
                    │   Router     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Load Balancer│
                    │(HAProxy/Nginx)
                    └────┬──┬──────┘
                    ┌───┴┐ └──┐────────┐
                    │         │        │
              ┌─────▼─┐ ┌────▼──┐ ┌──▼────┐
              │Server1│ │Server2│ │Server3│
              │(API)  │ │(API)  │ │(API)  │
              └───────┘ └───────┘ └───────┘
                        │
                  ┌─────▼────────┐
                  │Main Database │
                  │   (MySQL)    │
                  └──────────────┘
```

---

## Offline Functionality

### How It Works Without Internet

1. **Initial Setup**: Student device must connect to LAN server once to download exams
2. **Offline Mode**: IndexedDB stores exams locally on student's device
3. **Taking Exams**: No network needed after download (full offline capability)
4. **Sync Queue**: When reconnected, app automatically syncs answers back to server

### Configuration for Offline

**Frontend .env**:

```ini
REACT_APP_OFFLINE_ENABLED=true      # Enable offline mode
REACT_APP_SYNC_ENABLED=true         # Enable auto-sync
REACT_APP_SYNC_INTERVAL=30000       # Try sync every 30 seconds
```

**Backend Setup Sync Server**:

```powershell
# Terminal - Start Node.js sync server (handles offline syncs)
cd C:\xampp\htdocs\cbt-system\backend
npm install                          # Install dependencies
npm start                            # Starts sync server on port 5000
```

---

## Maintenance & Monitoring

### Daily Checklist

- [ ] Server uptime verified
- [ ] No CPU/RAM alerts
- [ ] Database size monitored (backup if growing)
- [ ] Network connectivity to all critical devices
- [ ] Recent backups completed

### Backup Strategy

```powershell
# Daily database export (schedule via Windows Task Scheduler)
mysqldump -h 127.0.0.1 -u root cbt_system > "D:\Backups\cbt_$(Get-Date -f 'yyyy-MM-dd_HH-mm-ss').sql"

# Weekly full system backup
# Use Windows Backup or third-party tools (Acronis, Veeam)
```

### Performance Monitoring

```powershell
# Monitor server resource usage
Get-Process | Where-Object {$_.ProcessName -like "*php*" -or $_.ProcessName -like "*mysql*"} |
    Select-Object Name, @{Name='RAM(MB)';Expression={[Math]::Round($_.WorkingSet/1MB, 2)}}
```

### Common Issues & Solutions

| Issue                      | Cause                                | Solution                                       |
| -------------------------- | ------------------------------------ | ---------------------------------------------- |
| Client can't reach server  | IP/Network config                    | Verify server static IP, client on same subnet |
| Database connection errors | MySQL not running                    | Start MySQL via XAMPP Control Panel            |
| Slow exams loading         | Network congestion                   | Check WiFi signal, switch to Ethernet          |
| Port 8000 already in use   | Another process using port           | Change port in `.env` and `php artisan serve`  |
| CORS errors                | Frontend/Backend not on same network | Update `SANCTUM_STATEFUL_DOMAINS` in `.env`    |

---

## Security Considerations for LAN

### Network Security

1. **Firewall**: Block ports from internet, only allow LAN subnet
2. **VPN Alternative**: Use VPN if connecting external branch offices
3. **Authentication**: Use strong admin passwords (minimum 12 characters)
4. **HTTPS**: Not needed for internal LAN (but consider for branch offices)

### Data Security

```powershell
# Encrypt database backups
# Use Windows EFS or third-party encryption

# Restrict file permissions
icacls "C:\xampp\htdocs\cbt-system" /grant:r Users:F /inheritance:e

# Regular security audits
# - Check logs for failed login attempts
# - Monitor unusual data access patterns
# - Update Laravel packages monthly
```

### User Access Control

- Main Admin: Full system control
- Admin: Exam management, student oversight
- Teacher: Class-level exam management
- Student: Exam-taking only

Set roles correctly to prevent accidental data exposure.

---

## Scaling Considerations

### When You Outgrow Single Server

**Phase 1** (0-100 users): Single server works fine
**Phase 2** (100-500 users):

- Separate database server (different machine)
- Consider Redis for caching

**Phase 3** (500+ users):

- Load balancing with multiple API servers
- Database clustering
- Dedicated storage (NAS)

```
Recommended for Phase 3:

┌────────────────────────────────────────┐
│       Router + Load Balancer           │
├────────────────────────────────────────┤
│  API Server 1  │  API Server 2  │ API3 │
├───────────────────────────────────────┤
│   Database Server (separate machine)   │
├───────────────────────────────────────┤
│  Redis Cache + Storage (NAS)           │
└────────────────────────────────────────┘
```

---

## Deployment Checklist

- [ ] Server machine prepared (static IP, specs verified)
- [ ] XAMPP installed with PHP 8.2+
- [ ] Project copied to server location
- [ ] `.env` files configured with correct server IP
- [ ] MySQL database created and migrated
- [ ] Firewall rules configured for ports 3306, 5000, 8000
- [ ] Laravel API tested (`php artisan serve`)
- [ ] Frontend built and served
- [ ] Client devices can connect to `http://SERVER_IP:3000`
- [ ] Test login with admin and student account
- [ ] Test exam assignment and student access
- [ ] Offline sync tested (download exam → go offline → take exam → sync)
- [ ] Backup strategy implemented
- [ ] UPS connected to server
- [ ] Network monitoring tools installed

---

## Conclusion

This LAN-based approach:

- ✅ Requires NO internet connection for operation
- ✅ Handles 50-100+ concurrent users on modern hardware
- ✅ Provides offline exam capability
- ✅ Ensures data security (all data stays on school network)
- ✅ Minimal performance overhead with proper configuration
- ✅ Easy student access (just navigate to school server IP)

For questions, refer to the individual component documentation or contact the development team.
