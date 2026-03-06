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

## Multiple Concurrent Users & Multi-Server Setup

### How Many People Can Connect Simultaneously?

The number of concurrent users your system can handle depends on server specs:

| Server Specs           | Concurrent Users | Notes                                                 |
| ---------------------- | ---------------- | ----------------------------------------------------- |
| **i5 + 8GB RAM**       | 20-30 users      | Light usage (browsing results)                        |
| **i7 + 16GB RAM**      | 50-100 users     | Typical exam-taking with some idle time               |
| **i9/Xeon + 32GB RAM** | 100-200+ users   | Heavy usage, all students taking exams simultaneously |

**Real-World Example:**

- If your school has **500 students** but exams are **staggered by class**, you might have:
  - JSS1: 50 Students taking exam at 8am
  - JSS2: 50 Students taking exam at 9am
  - JSS3: 50 Students taking exam at 10am
  - Maximum concurrent = 50 users (not 500!)

**How connections work:**

1. Each student's device = **1 connection** to server
2. Server handles 50-100 simultaneous connections easily with standard hardware
3. Database allows 500-1000 concurrent MySQL connections (plenty)
4. **No additional licensing needed** - each person just accesses the shared server

---

### What If You Have Multiple Server PCs? (Branch Offices/Large Schools)

**Scenario A: Multiple Exam Centers at Same Location**

If your school has **multiple exam halls** on same LAN:

```
┌─────────────────────────────────────────────────────┐
│            School Network (Single Router)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│    MAIN/HUB SERVER              SECONDARY SERVER   │
│    (Lab 1 - 50 users)          (Lab 2 - 50 users) │
│    [Primary Database]          [Read Replica DB]   │
│    192.168.1.100               192.168.1.101      │
│                                                     │
│    ┌─────────────┐              ┌──────────────┐  │
│    │ Admin PC    │              │ Teacher PC   │  │
│    └─────────────┘              └──────────────┘  │
│                                                     │
│    ┌──────────┐  ┌──────────┐   ┌──────────┐      │
│    │Student1  │  │Student2  │   │Student50 │      │
│    └──────────┘  └──────────┘   └──────────┘      │
│                                    All using        │
│                                  Primary Server    │
│                                  API (Load Balanced)│
└─────────────────────────────────────────────────────┘
```

**Setup for Multiple Servers:**

```powershell
# SERVER 1 (Primary - HUB)
IP: 192.168.1.100
Roles:
  - Main API endpoint (all clients connect here)
  - MySQL Database (master)
  - All exam data stored here

# SERVER 2 (Secondary - Optional)
IP: 192.168.1.101
Roles:
  - API Failover (if Server 1 goes down)
  - Static exam file caching
  - Exam sync processor (offload from primary)
```

**Configuration for Multi-Server:**

**Primary Server (.env)**:

```ini
APP_URL=http://192.168.1.100
DB_HOST=127.0.0.1
DB_PORT=3306
CACHE_HOST=127.0.0.1        # Cache server (if using Redis)
```

**Secondary Server (.env)**:

```ini
APP_URL=http://192.168.1.100  # Still point to PRIMARY for DB
DB_HOST=192.168.1.100         # Connect to PRIMARY database
DB_PORT=3306
READONLY_MODE=true            # Secondary only serves static content
```

**Client Configuration** - Both servers serve same content:

```ini
# Frontend still points to PRIMARY
REACT_APP_API_URL=http://192.168.1.100:8000/api

# OR use Round-Robin DNS
REACT_APP_API_URL=http://cbt-server.local/api
# (DNS resolves to 192.168.1.100 and 192.168.1.101)
```

---

### Scenario B: Different Branch Offices (Decentralized)

If you have **multiple schools** with separate exam centers:

```
┌─────────────────────────────┬─────────────────────────────┐
│     SCHOOL A (Building 1)   │    SCHOOL B (Building 2)    │
│     IP: 192.168.1.100       │    IP: 192.168.2.100        │
│                             │                             │
│  MAIN SERVER A              │   MAIN SERVER B             │
│  ├─ API                     │   ├─ API                    │
│  ├─ Database A              │   ├─ Database B             │
│  └─ 50 Students             │   └─ 75 Students            │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘
      Local Exam Data              Local Exam Data
      Local Results                Local Results
```

**Setup Option 1: Completely Independent** (Recommended)

```powershell
# Each school has its own server - NO connection needed
# School A: 192.168.1.100:8000/api
# School B: 192.168.2.100:8000/api

# Daily sync: Central admin uploads exam to each server separately
# No network link required between schools
# Each school works independently
```

**Setup Option 2: Sync Between Schools** (Advanced)

```powershell
# If you want to sync results back to central database nightly:

# School A Server
DB_HOST=192.168.1.100         # Local database
SYNC_REMOTE_DB=192.168.0.50   # Central office database (for sync)

# School B Server
DB_HOST=192.168.2.100         # Local database
SYNC_REMOTE_DB=192.168.0.50   # Central office database (for sync)

# Nightly sync script fetches results from all schools
# and aggregates in central office for reporting
```

---

### Real Example: 500-Student School

**Exam Schedule:**

```
08:00-09:30: JSS1 (60 students) - Exam 1
09:45-11:15: JSS2 (70 students) - Exam 2
11:30-13:00: JSS3 (80 students) - Exam 3
14:00-15:30: SSS1 (90 students) - Exam 4
15:45-17:15: SSS2 (100 students) - Exam 5
```

**Single Server Solution** (Recommended for 500 students):

```
Time    | Users Online | Server Load
--------|--------------|----------
08:00   | 60 (JSS1)    | 10% CPU, 2GB RAM
09:00   | 60 (JSS1)    | 10% CPU, 2GB RAM
09:45   | 5 + 70       | 15% CPU, 3GB RAM (staggered start)
10:00   | 70 (JSS2)    | 15% CPU, 3GB RAM
...
Peak:   | 100 (SSS2)   | 20% CPU, 4GB RAM

✅ Single i7 + 16GB server handles all 5 exams easily
✅ NO additional servers needed for staggered exams
```

**If All 500 Students Took Exam Simultaneously** (Worst case):

```
Scenario: Emergency online assessment, all at once
Max Users: 500
Timeline:  Need to distribute over 2-3 hours minimum

Solution 1: Single Powerful Server
- Server: i9 + 32GB RAM + SSD
- Cost: $3,000-5,000
- Handles 500 users, 20% CPU usage

Solution 2: Two Servers (Load Balanced)
- Server 1: i7 + 16GB (250 users)
- Server 2: i7 + 16GB (250 users)
- Cost: $2,500-3,500 x2
- Setup: Nginx load balancer distributes traffic
```

---

### Network Impact (Won't Affect Regular Workload)

**Bandwidth Per User Taking Exam:**

- Submit an answer: ~5KB every 30 seconds
- Download exam questions: ~500KB (one-time)
- View results: ~100KB
- **Total per hour per user: ~1-2MB**

**500 Students Taking Exams (Staggered):**

```
Peak usage: 100 students × 2MB/hour = 200MB/hour
Converting: 200MB/hour ÷ 3600 seconds = 55KB/sec

Standard LAN Speed: 1000 Mbps (125 MB/sec)
Usage Percentage: 55KB/sec ÷ 125MB/sec = 0.04%

✅ Less than 1% of network capacity used
✅ No impact on other school operations
✅ Can run email, file sharing, browsing simultaneously
```

---

### Performance Monitoring for Multi-User Setup

```powershell
# Check server health during exam period
# Terminal on Server PC:

# CPU Usage
Get-Process | Measure-Object -Property CPU -Sum

# RAM Usage
Get-ComputerInfo | Select-Object CsTotalPhysicalMemory, OsAvailablePhysicalMemory

# Active Database Connections
# In MySQL:
SHOW PROCESSLIST;              # Shows all connected users
SELECT COUNT(*) FROM information_schema.PROCESSLIST;

# Network Traffic
netsh interface tcp show global          # View connection stats
```

---

## Centralized Database Architecture (Recommended for Multiple Servers)

This is the **best setup for scaling** - all servers share ONE central database while running separate API/Frontend instances.

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Central Network (School)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │      CENTRAL DATABASE SERVER (Master)                  │     │
│  │      IP: 192.168.1.50                                 │     │
│  │      ├─ MySQL Database (Port 3306)                    │     │
│  │      ├─ Data: All exams, students, results           │     │
│  │      ├─ Storage: 1TB SSD                              │     │
│  │      └─ Backup: Daily automated backups              │     │
│  └────────────────────────────────────────────────────────┘     │
│             ▲                      ▲                   ▲          │
│             │                      │                   │          │
│             │ MySQL Connection     │ MySQL Conn       │ MySQL    │
│             │ (Network)           │ (Network)        │ Conn     │
│             │                      │                   │          │
│  ┌──────────┴──┐         ┌────────┴────┐       ┌──────┴───┐    │
│  │  API SERVER │         │  API SERVER │       │  API SRV │    │
│  │  #1 (Main)  │         │  #2 (Lab)   │       │  #3 (Adm)│    │
│  │ 192.168.1.  │         │ 192.168.1.  │       │ 192.168. │    │
│  │     100     │         │     101     │       │ 1.102    │    │
│  │             │         │             │       │          │    │
│  │ ┌─────────┐ │         │ ┌─────────┐ │       │ ┌──────┐ │    │
│  │ │Laravel  │ │         │ │Laravel  │ │       │ │Larav │ │    │
│  │ │API      │ │         │ │API      │ │       │ │el AP │ │    │
│  │ │8000     │ │         │ │8000     │ │       │ │I:8000│ │    │
│  │ └─────────┘ │         │ └─────────┘ │       │ └──────┘ │    │
│  │             │         │             │       │          │    │
│  │ ┌─────────┐ │         │ ┌─────────┐ │       │ ┌──────┐ │    │
│  │ │React    │ │         │ │React    │ │       │ │React │ │    │
│  │ │Frontend │ │         │ │Frontend │ │       │ │FE    │ │    │
│  │ │3000     │ │         │ │3000     │ │       │ │3000  │ │    │
│  │ └─────────┘ │         │ └─────────┘ │       │ └──────┘ │    │
│  │ 50 Students │         │ 75 Students │       │ 25 Admin │    │
│  └─────────────┘         │             │       │          │    │
│                          └─────────────┘       └──────────┘    │
│   Lab 1               Lab 2                Admin Office         │
│  (Main Hub)          (Extension)          (Management)         │
│                                                                  │
│                          All Locations                          │
│                      Share SAME Database                        │
│                     Connected via Network                       │
└──────────────────────────────────────────────────────────────────┘
```

### Key Benefits

✅ **Single Source of Truth**: All exam data in one place
✅ **Easy Data Sync**: Results from all servers automatically synced
✅ **Scalability**: Add more API servers without complications
✅ **Unified Reporting**: All results accessible from everywhere
✅ **Backup Simplicity**: Backup once, protect all locations
✅ **User Consistency**: Students see same data everywhere

---

### Hardware Requirements

**Central Database Server:**

- **CPU**: Intel Xeon / AMD Ryzen 5 (multi-core essential)
- **RAM**: 16GB-32GB (database loves RAM)
- **Storage**: 500GB-1TB SSD (fast I/O for database)
- **Network**: Gigabit Ethernet (dedicated connection)
- **Redundancy**: RAID 1 (mirrors data across 2 drives)
- **Power**: UPS with 4-hour backup

**API/Frontend Servers** (Can be modest):

- **CPU**: i5 or Ryzen 3
- **RAM**: 8GB
- **Storage**: 256GB SSD (just app files)
- **Network**: Gigabit Ethernet

**Example Cost Breakdown:**

```
Central DB Server (good quality): $2,500
API Server #1 (basic): $800
API Server #2 (basic): $800
Network Switch: $400
Total: ~$4,500 for 3-server setup
```

---

### Network Configuration

**Database Server Network Settings:**

```ini
IP Address:        192.168.1.50
Subnet Mask:       255.255.255.0
Gateway:           192.168.1.1
DNS:               8.8.8.8, 8.8.4.4
Static IP:         ✅ YES (critical!)
Firewall Port:     3306 (allow from 192.168.1.0/24)
```

**Windows Firewall for Database Server:**

```powershell
# Allow MySQL from internal network ONLY
netsh advfirewall firewall add rule name="MySQL Local Only" ^
    dir=in action=allow protocol=tcp localport=3306 ^
    remoteip=192.168.1.0/24

# Block MySQL from internet
netsh advfirewall firewall add rule name="MySQL Block Internet" ^
    dir=in action=block protocol=tcp localport=3306 ^
    remoteip=0.0.0.0/0
```

---

### Setup Steps: Centralized Database

#### Step 1: Prepare Database Server

```powershell
# On Database Server PC (192.168.1.50):

# Install MySQL Server (standalone, not XAMPP)
# Download: https://dev.mysql.com/downloads/mysql/

# Post-install:
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"

# Create CBT database
mysql -u root -p
> CREATE DATABASE cbt_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'cbt_user'@'%' IDENTIFIED BY 'SecurePassword123!';
> GRANT ALL PRIVILEGES ON cbt_system.* TO 'cbt_user'@'%';
> FLUSH PRIVILEGES;
> EXIT;
```

#### Step 2: Enable Remote Connections

**File**: `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini`

```ini
[mysqld]
# Default: bind-address = 127.0.0.1 (localhost only)
# Change to:
bind-address = 0.0.0.0             # Listen on all interfaces
port = 3306
max_connections = 1000
```

**Restart MySQL:**

```powershell
Restart-Service MySQL80
```

#### Step 3: Test Remote Connection

**From API Server PC (192.168.1.100):**

```powershell
# Download MySQL Client tools if needed
# Test connection:
mysql -h 192.168.1.50 -u cbt_user -p
# Enter password: SecurePassword123!
```

If connection succeeds:

```sql
SHOW DATABASES;
USE cbt_system;
SHOW TABLES;           # Should be empty (no tables yet)
```

#### Step 4: Configure API Server #1 (Main)

**File**: `C:\xampp\htdocs\cbt-system\backend\.env`

```ini
# Application
APP_NAME=CBT_System
APP_ENV=production
APP_URL=http://192.168.1.100

# Database - Points to CENTRAL SERVER
DB_CONNECTION=mysql
DB_HOST=192.168.1.50        # ← Central DB server IP
DB_PORT=3306
DB_DATABASE=cbt_system
DB_USERNAME=cbt_user
DB_PASSWORD=SecurePassword123!

# API
API_URL=http://192.168.1.100:8000

# Frontend
FRONTEND_URL=http://192.168.1.100:3000

# Sanctum
SANCTUM_STATEFUL_DOMAINS=192.168.1.100
```

**Run Migrations on API Server #1** (Only once!):

```powershell
cd C:\xampp\htdocs\cbt-system\backend
php artisan migrate
php artisan seed:run
```

⚠️ **IMPORTANT**: Only run migrations from ONE server, not all!

#### Step 5: Configure API Server #2 (Lab)

**File**: `C:\xampp\htdocs\cbt-system\backend\.env`

```ini
# Application
APP_NAME=CBT_System
APP_ENV=production
APP_URL=http://192.168.1.101    # Different IP

# Database - Points to SAME CENTRAL SERVER
DB_CONNECTION=mysql
DB_HOST=192.168.1.50            # ← Same as Server #1
DB_PORT=3306
DB_DATABASE=cbt_system
DB_USERNAME=cbt_user
DB_PASSWORD=SecurePassword123!

# API
API_URL=http://192.168.1.101:8000

# Frontend
FRONTEND_URL=http://192.168.1.101:3000

# Sanctum
SANCTUM_STATEFUL_DOMAINS=192.168.1.101
```

**DO NOT run migrations** - database already exists!

Just start the API:

```powershell
cd C:\xampp\htdocs\cbt-system\backend
php artisan serve --host 192.168.1.101 --port 8000
```

#### Step 6: Configure API Server #3 (Admin)

Same as #2, but with `192.168.1.102` instead of `.101`

#### Step 7: Frontend Configuration

**Each frontend server points to its local API:**

**API Server #1** - `frontend\.env`:

```ini
REACT_APP_API_URL=http://192.168.1.100:8000/api
```

**API Server #2** - `frontend\.env`:

```ini
REACT_APP_API_URL=http://192.168.1.101:8000/api
```

**API Server #3** - `frontend\.env`:

```ini
REACT_APP_API_URL=http://192.168.1.102:8000/api
```

---

### Load Balancing (Optional - for even distribution)

If you want to distribute traffic across servers automatically:

```
┌─────────────────────────────────────┐
│  Load Balancer (Nginx)              │
│  192.168.1.99                       │
├─────────────────────────────────────┤
│  Forward all /api requests to:      │
│  - API #1 (192.168.1.100)  50%      │
│  - API #2 (192.168.1.101)  50%      │
│  - API #3 (192.168.1.102)  Backup   │
└─────────────────────────────────────┘
       ▲
       │
    Clients connect to:
    http://192.168.1.99:8000/api
    (instead of individual servers)
```

**Nginx Configuration** (`C:\nginx\conf\nginx.conf`):

```nginx
upstream cbt_api {
    server 192.168.1.100:8000 weight=50;
    server 192.168.1.101:8000 weight=50;
    server 192.168.1.102:8000 backup;
}

server {
    listen 8000;
    server_name _;

    location / {
        proxy_pass http://cbt_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### Data Consistency & Synchronization

**How it stays in sync:**

```
Student takes exam on API Server #1
├─ Submits answer
├─ API #1 sends to Central DB (192.168.1.50)
│  └─ DB stores answer
│
Teacher checks results on API Server #3
├─ Requests results from API #3
├─ API #3 queries Central DB (192.168.1.50)
└─ Shows up-to-date results

✅ Always in sync (single database)
```

**No manual sync needed** - all servers query the same database!

---

### Failover Strategy

**If Central DB Server Goes Down:**

```
All API servers unable to connect → System offline
Solution: Database failover server (secondary)

┌─────────────────────────────────┐
│  Primary DB (192.168.1.50)      │
│  (Main)                         │
└──────────┬──────────────────────┘
           │ MySQL Replication
           ▼
┌─────────────────────────────────┐
│  Secondary DB (192.168.1.51)    │
│  (Standby/Read-Only)            │
└─────────────────────────────────┘
```

**Setup MySQL Replication:**

```sql
-- On Primary (192.168.1.50):
CHANGE MASTER TO
  MASTER_HOST='192.168.1.51',
  MASTER_USER='repl_user',
  MASTER_PASSWORD='repl_pass';

START SLAVE;
SHOW SLAVE STATUS;
```

If Primary fails, manually promote Secondary:

```powershell
# Quick failover script
mysql -h 192.168.1.51 -u root -p
> STOP SLAVE;
> RESET SLAVE ALL;
> SET GLOBAL read_only = OFF;
```

Update `.env` on all API servers to point to Secondary:

```ini
DB_HOST=192.168.1.51  # Now Secondary becomes Primary
```

---

### Recommended Checklist: Centralized DB Setup

- [ ] Central DB server hardware installed (16GB RAM minimum)
- [ ] MySQL Server installed and running
- [ ] Database created: `cbt_system`
- [ ] User created: `cbt_user` with privileges
- [ ] Remote connections enabled (`bind-address = 0.0.0.0`)
- [ ] Firewall allows MySQL from LAN subnet
- [ ] Test connection from each API server successful
- [ ] API Server #1 configured with `.env`
- [ ] Migrations run on API Server #1 only
- [ ] API Server #2, #3 configured (NO migrations)
- [ ] All API servers connect and share same data
- [ ] Test: Create data on API #1, verify visible on API #2 & #3
- [ ] Backup strategy documented
- [ ] Optional: Load balancer configured
- [ ] Optional: Secondary DB for failover set up

---

## Step-by-Step Setup (Windows + XAMPP)

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
