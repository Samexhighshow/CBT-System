# Quick CSV Import Guide

## How to Use Bulk Upload Feature

### In the Application:
1. Navigate to **Admin Panel** → **Subject Management**
2. Click the appropriate tab (Classes, Departments, or Subjects)
3. Click **"Upload CSV"** button
4. Select your CSV file
5. Review the template format (click **"Download Sample CSV"** to see exact format)
6. Click **"Import"** to upload

## CSV Templates

### 1. Classes CSV
**Purpose:** Define school class levels (SSS 1, SSS 2, SSS 3, etc.)

**File Name:** `classes.csv`

**Format:**
```
name,description,capacity,is_active
SSS 1,Senior Secondary School 1,30,1
SSS 2,Senior Secondary School 2,30,1
SSS 3,Senior Secondary School 3,35,1
JSS 1,Junior Secondary School 1,25,1
JSS 2,Junior Secondary School 2,25,1
JSS 3,Junior Secondary School 3,25,1
```

**Column Descriptions:**
- `name` (required): Class level name (e.g., "SSS 1", "JSS 1")
- `description` (optional): What the class represents
- `capacity` (optional): Number of students. Default: 30
- `is_active` (optional): 1 for active, 0 for inactive. Default: 1

**Example (Minimum):**
```
name,description,capacity,is_active
SSS 1,,30,1
SSS 2,,30,1
```

---

### 2. Departments CSV
**Purpose:** Create departments under specific class levels

**File Name:** `departments.csv`

**Format:**
```
name,code,description,class_level,is_active
Science,SCI,Science Department,SSS 1,1
Arts & Humanities,ART,Arts Department,SSS 1,1
Social Sciences,SOC,Social Sciences,SSS 1,1
Commerce,COM,Commerce Department,SSS 2,1
Science,SCI,Science Department,SSS 2,1
Arts & Humanities,ART,Arts Department,SSS 2,1
```

**Column Descriptions:**
- `name` (required): Department name (can repeat under different class levels)
- `code` (required): Unique department code (must be unique across all departments)
- `description` (optional): What the department offers
- `class_level` (required): Must match a class name from Classes table
- `is_active` (optional): 1 for active, 0 for inactive. Default: 1

**Important:** `class_level` must exactly match a class name you created in the Classes CSV!

**Example:**
```
name,code,description,class_level,is_active
Science,SCI-1,Science,SSS 1,1
Arts,ART-1,Arts,SSS 1,1
Science,SCI-2,Science,SSS 2,1
```

---

### 3. Subjects CSV
**Purpose:** Add subjects to specific classes

**File Name:** `subjects.csv`

**Format:**
```
name,code,class_id,subject_type,description
Mathematics,MATH01,1,core,Core Mathematics
English Language,ENG01,1,core,English Language
Biology,BIO01,1,core,Core Science
Government,GOV01,1,elective,Elective - Government
Literature,LIT01,1,elective,Elective - Literature in English
```

**Column Descriptions:**
- `name` (required): Subject name
- `code` (required): Subject code (unique per class)
- `class_id` (required): ID of the class this subject belongs to (1, 2, 3, etc.)
- `subject_type` (required): Either "core" (compulsory) or "elective" (optional)
- `description` (optional): Subject description

**Finding Class IDs:**
In the application, go to **Classes** tab and check the class ID column, or:
- SSS 1 = usually ID 1
- SSS 2 = usually ID 2
- SSS 3 = usually ID 3
- (depends on your system)

**Example:**
```
name,code,class_id,subject_type,description
Mathematics,MATH,1,core,
English,ENG,1,core,
French,FREN,1,elective,
Physics,PHY,2,core,
Chemistry,CHE,2,core,
History,HIST,2,elective,
```

---

## Important Rules

### Classes:
- ✓ Each class name must be unique
- ✓ Cannot have duplicate class names
- ✓ capacity must be a number
- ✓ is_active must be 0 or 1

### Departments:
- ✓ Each department code must be unique (globally, not per class)
- ✓ `class_level` must match an existing class name exactly (case-sensitive!)
- ✓ You can have departments with the same name under different classes (e.g., "Science" under SSS 1 and SSS 2)
- ✓ Cannot have duplicate codes
- ✓ is_active must be 0 or 1

### Subjects:
- ✓ class_id must point to an existing class (check the Classes tab for IDs)
- ✓ subject_type must be EXACTLY "core" or "elective" (case-insensitive)
- ✓ Each subject code must be unique within its class
- ✓ Cannot have the same subject name + class_id combination twice
- ✓ is_compulsory is auto-set: core subjects are compulsory, elective are optional

---

## Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing required fields" | A column is empty that shouldn't be | Fill in all required columns |
| "already exists" | Name/code is duplicate | Check for duplicates, use different name/code |
| "not found in classes" | class_level doesn't match a class | Check class names in Classes tab; match exactly |
| "Invalid CSV header" | Column names are wrong | Use exact format from template |
| "class_id not found" | Class doesn't exist | Check class ID in Classes tab |
| "subject_type must be core or elective" | Value is neither "core" nor "elective" | Use exactly "core" or "elective" |

---

## Sample Complete Workflow

### Step 1: Create Classes
```csv
name,description,capacity,is_active
SSS 1,Senior Secondary 1,35,1
SSS 2,Senior Secondary 2,35,1
SSS 3,Senior Secondary 3,35,1
```
Upload to `/classes/bulk-upload` → Get confirmation of 3 imported

### Step 2: Create Departments
```csv
name,code,description,class_level,is_active
Science,SCI1,Science Stream,SSS 1,1
Arts & Humanities,ART1,Arts Stream,SSS 1,1
Science,SCI2,Science Stream,SSS 2,1
Arts & Humanities,ART2,Arts Stream,SSS 2,1
Commerce,COM2,Commerce Stream,SSS 2,1
```
Upload to `/departments/bulk-upload` → Get confirmation of 5 imported

### Step 3: Create Subjects
```csv
name,code,class_id,subject_type,description
Mathematics,MATH,1,core,Compulsory
English,ENG,1,core,Compulsory
Biology,BIO,1,core,Science Stream
Government,GOV,1,elective,For Arts Students
Chemistry,CHE,2,core,Science Stream
Economics,ECO,2,elective,For Commerce Students
```
Upload to `/subjects/bulk-upload` → Get confirmation of 6 imported

### Success!
All data is now in your system and linked correctly:
- Subjects are assigned to classes
- Departments are grouped under class levels
- Students can select subjects from their class
- Teachers can teach subjects in their department

---

## Troubleshooting

### Upload fails with no error message
- Check file format (must be .csv or .txt)
- File size must be under 5MB
- Try using a different CSV editor (Excel, Google Sheets)

### Some rows import, but others don't
- Scroll the error message box to see individual row errors
- Fix those rows and re-upload just the failed ones

### Class matches but departments don't import
- Verify the `class_level` value matches class name exactly
- Check for extra spaces or different capitalization
- Departments import with case-sensitive matching

### Need to re-import with corrections?
- You can upload again - update the records or add new ones
- Duplicate names/codes will be rejected (which is correct)
- Delete and re-create if you need to change values

---

**Last Updated:** December 2025
