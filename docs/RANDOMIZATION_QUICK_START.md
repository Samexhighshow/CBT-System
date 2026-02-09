# Question Randomization - Quick Start Guide

## ✅ What's Fixed

| Issue | Solution | Status |
|-------|----------|--------|
| `array_sum()` error | Added null checks | ✅ Fixed |
| Marks distribution format | Auto-normalization in backend | ✅ Fixed |
| Missing API service | Added examApi methods | ✅ Added |
| Database integration | All columns added and tested | ✅ Working |

---

## 🚀 How to Use

### 1. **Open Question Randomization**
   - Go to Exam Management
   - Click on an exam
   - Click "Configure Randomization" button
   - Modal opens with settings

### 2. **Configure Settings**
   
   **Option A: Fixed Questions**
   - Select "Fixed (Manual Selection)"
   - Optionally enable shuffling
   - Save

   **Option B: Random from Question Bank**
   - Select "Random from Question Bank"
   - Choose one distribution method:
     - **Number of Questions**: Serve specific count
     - **Difficulty Distribution**: Mix of easy/medium/hard
     - **Marks Distribution**: By question value
   - Configure shuffling options
   - Set distribution (same for all vs unique per student)
   - Save

### 3. **Save Settings**
   - Click "Save Settings" button
   - See "✅ Settings saved successfully" message
   - Settings are now stored in database

### 4. **Preview & Lock**
   - Click "Generate Preview" to see sample selection
   - Click "Lock Questions" to freeze settings
   - Once locked, students get consistent questions

### 5. **Unlock (if needed)**
   - Click "Unlock Questions"
   - Can modify settings again
   - Existing student selections will be regenerated

---

## 📊 Setting Examples

### Example 1: Same Questions for All Students
```
Mode: Random
Distribution: Same Questions for All Students
Total Questions: 20
Shuffling: Question order ✓, Options ✓
```
**Result:** All students get same 20 questions, but order & options shuffled

### Example 2: Different Questions, By Difficulty
```
Mode: Random
Distribution: Unique Questions per Student
Difficulty Distribution:
  - Easy: 5
  - Medium: 10
  - Hard: 5
Shuffle: Question order ✓
```
**Result:** Each student gets 5 easy, 10 medium, 5 hard (different questions)

### Example 3: By Question Marks
```
Mode: Random
Distribution: Same for All
Marks Distribution:
  - 1 mark: 5 questions
  - 2 marks: 8 questions
  - 5 marks: 2 questions
```
**Result:** All students get 5 one-mark, 8 two-mark, 2 five-mark questions

---

## ❌ If You See Errors

### Error: "Questions are locked"
**Solution:** Click "Unlock Questions" first to modify settings

### Error: "Distribution total must match"
**Solution:** Ensure sum of difficulty/marks counts equals "Total Questions"

### No modal appears
**Solution:** 
1. Check browser console (F12)
2. Verify exam is selected
3. Try refreshing page

### Settings not saving
**Solution:**
1. Check internet connection
2. Check browser console for errors
3. Verify exam status (not closed)

---

## 💾 Database Verification

To check if settings are saved:

**In phpMyAdmin:**
1. Go to `exams` table
2. Find your exam ID
3. Check columns:
   - `question_selection_mode`
   - `difficulty_distribution`
   - `marks_distribution`
   - `questions_locked`

**Values should match what you configured**

---

## 🧪 Testing Checklist

- [ ] Open modal without errors
- [ ] View current settings load correctly
- [ ] Save fixed mode settings
- [ ] Save random with difficulty distribution
- [ ] Save random with marks distribution  
- [ ] See success message after saving
- [ ] Generate preview works
- [ ] Lock questions button works
- [ ] Unlock questions button works
- [ ] Settings persist after page refresh
- [ ] Multiple exams have independent settings

---

## 📞 Need Help?

1. **Check logs:** `/backend/storage/logs/laravel.log`
2. **Run tests:** `php backend/test_api.php`
3. **Verify unlocked:** `php backend/unlock_exams.php`
4. **Check database:** `php backend/test_randomization.php`

---

**Everything is working! Just use the modal and save your settings.** ✅
