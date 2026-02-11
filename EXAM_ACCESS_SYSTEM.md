# Exam Access Management System - Implementation Guide

## Overview
The Exam Access Management system provides secure, one-time password (OTP) access for students on exam day. Each student receives a unique access code that can only be used once per exam session.

## Key Features

### 1. **One-Time Access Codes**
- Each code is valid for only one use
- Automatically expires at the end of exam day
- 8-character alphanumeric codes (easy to read/type)
- Cannot be reused after authentication

### 2. **Admin Management**
**Location:** Admin Dashboard → Exam Access (navigation bar)

**Capabilities:**
- View all exams scheduled for today
- Generate access codes for multiple students at once
- Input registration numbers (comma, space, or line-separated)
- View all generated codes with usage status
- Filter codes by used/unused status
- Search by student reg number, name, or exam
- Revoke unused codes if needed
- Copy codes to clipboard for distribution

### 3. **Student Access**
**Location:** `/exam-access` route (link on student login page)

**Flow:**
1. Student receives access code from exam supervisor
2. Enters registration number and access code
3. System verifies code validity and usage status
4. If valid, student is authenticated and redirected to exam
5. Code is marked as used and cannot be reused

## Database Schema

### Table: `exam_access`
```sql
- id (bigint, primary key)
- exam_id (foreign key → exams)
- student_id (foreign key → users)
- access_code (string, 8 chars, unique)
- used (boolean, default false)
- used_at (timestamp, nullable)
- expires_at (timestamp, nullable)
- created_at, updated_at (timestamps)
```

**Indexes:**
- `exam_id, student_id` (compound)
- `access_code` (unique)
- `used` (for filtering)

## API Endpoints

### Admin Endpoints (Protected)

#### Get Today's Exams
```
GET /api/admin/exams/today
```
Returns all exams scheduled for the current day.

#### Get All Access Records
```
GET /api/admin/exam-access
```
Returns all generated access codes with student and exam details.

#### Generate Access Codes
```
POST /api/admin/exam-access/generate
Body: {
  exam_id: number,
  reg_numbers: string[] // Array of registration numbers
}
```
Generates unique access codes for the specified students.

#### Revoke Access Code
```
DELETE /api/admin/exam-access/{id}
```
Deletes an unused access code.

### Public Endpoint

#### Verify Access Code
```
POST /api/exam-access/verify
Body: {
  access_code: string,
  reg_number: string
}
```
Verifies the access code and marks it as used if valid.

## Use Cases

### Morning/Afternoon Sessions
**Problem:** Students have multiple exams in one day (e.g., Math at 9 AM, English at 2 PM)

**Solution:**
1. Admin generates access codes for Math exam in morning
2. Students use codes to access Math exam
3. Codes become invalid after use
4. Admin generates new codes for English exam in afternoon
5. Students receive fresh codes for afternoon session

### Benefits
- Prevents code sharing between sessions
- Ensures each exam session is secure
- Allows flexible scheduling throughout the day
- Easy to manage and track

## Frontend Components

### Pages
1. **ExamAccess.tsx** (`/admin/exam-access`)
   - Admin interface for code generation and management
   - Lists today's exams
   - Bulk code generation
   - Usage tracking and filtering

2. **ExamAccessLogin.tsx** (`/exam-access`)
   - Student login interface
   - Access code verification
   - Direct exam redirection

### Navigation
- Added "Exam Access" link to admin navigation bar (icon: `bx-key`)
- Added link on student login page for exam access login

## Backend Components

### Models
- **ExamAccess.php**
  - Relationships: `exam()`, `student()`
  - Methods: `isValid()`, `markAsUsed()`, `generateUniqueCode()`

### Controllers
- **ExamAccessController.php**
  - Handles all CRUD operations
  - Code generation logic
  - Verification and usage tracking

### Migration
- **2025_12_11_050639_create_exam_access_table.php**
  - Creates `exam_access` table with proper indexes

## Security Features

1. **One-Time Use:** Codes cannot be reused
2. **Time-Limited:** Codes expire at end of exam day
3. **Student-Specific:** Each code tied to specific student and exam
4. **Revocable:** Admins can revoke unused codes
5. **Audit Trail:** Tracks when codes are generated and used

## Workflow Example

### Admin Workflow
```
1. Navigate to Admin → Exam Access
2. Select exam from "Today's Exams" dropdown
3. Enter student registration numbers:
   - REG001, REG002, REG003 (comma-separated)
   - Or paste one per line
4. Click "Generate Access Codes"
5. System creates unique codes for each student
6. Codes displayed in table with copy functionality
7. Distribute codes to students (print, SMS, email, etc.)
```

### Student Workflow
```
1. Receive access code from supervisor
2. Go to /exam-access page
3. Enter registration number
4. Enter 8-character access code
5. Click "Access Exam"
6. System verifies and redirects to exam portal
7. Access code marked as used
```

## Error Handling

### Common Errors
- **Invalid Code:** Code doesn't exist or doesn't match exam
- **Already Used:** Code has been used previously (shows usage time)
- **Expired:** Code expiration date has passed
- **Student Not Found:** Registration number doesn't exist
- **Duplicate Code:** Student already has unused code for exam

## Testing Checklist

- [ ] Generate codes for single student
- [ ] Generate codes for multiple students (bulk)
- [ ] Verify valid access code works
- [ ] Verify invalid code is rejected
- [ ] Verify used code cannot be reused
- [ ] Verify code expiration works
- [ ] Verify code revocation works
- [ ] Test filtering by used/unused status
- [ ] Test search functionality
- [ ] Test copy to clipboard
- [ ] Test morning/afternoon multi-session scenario

## Future Enhancements

1. **SMS Integration:** Auto-send codes via SMS
2. **Email Distribution:** Bulk email codes to students
3. **QR Codes:** Generate scannable QR codes
4. **Analytics:** Track code usage patterns
5. **Batch Printing:** Print codes in batches with student names
6. **Custom Expiry:** Set custom expiration times per exam

## Files Modified/Created

### Frontend
- Created: `frontend/src/pages/admin/ExamAccess.tsx`
- Created: `frontend/src/pages/ExamAccessLogin.tsx`
- Modified: `frontend/src/components/layout/AdminLayout.tsx`
- Modified: `frontend/src/pages/AdminDashboard.tsx`
- Modified: `frontend/src/pages/StudentLogin.tsx`
- Modified: `frontend/src/App.tsx`

### Backend
- Created: `backend/app/Models/ExamAccess.php`
- Created: `backend/app/Http/Controllers/Api/ExamAccessController.php`
- Created: `backend/database/migrations/2025_12_11_050639_create_exam_access_table.php`
- Modified: `backend/routes/api.php`

## Support & Troubleshooting

### "Code already used" error
- Each code can only be used once
- Generate a new code for the student
- Check if student already accessed the exam

### Codes not appearing
- Ensure exam is scheduled for today
- Check database connection
- Verify student registration numbers are correct

### Student cannot login with code
- Verify code hasn't expired
- Check if code matches the exam
- Ensure registration number is correct (case-sensitive)

---

**Implementation Date:** December 11, 2025  
**Version:** 1.0  
**Status:** ✅ Complete and Ready for Use
