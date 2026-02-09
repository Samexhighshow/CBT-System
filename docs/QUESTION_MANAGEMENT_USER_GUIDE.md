# Question Management - User Guide

## Quick Start

### 1. Importing Questions from CSV/Excel

**Step 1**: Click the "Upload CSV File" card
- Choose file format: `.csv`, `.xlsx`, or `.xls`
- File must have columns: question_text, type, marks, difficulty

**Step 2**: View import results
- **Summary**: Shows total imported vs. failed
- **Failed rows**: Lists first 5 failures with error reasons
- **Download report**: Click "See Report" to download full error CSV

**Step 3**: Review imported questions
- Questions appear in table with status "Active"
- Check marks and difficulty in summary
- Edit any questions that need adjustment

### 2. Viewing Question History

**Step 1**: Click the purple "View History" button next to any question
- Button appears in action menu alongside Preview and Edit
- Works in both table view and grouped-by-section view

**Step 2**: Explore version history
- See all versions with timestamps
- Check what changed in each version
- View who made changes (change notes)

**Step 3**: Revert to previous version (if needed)
- Click "Revert" button on any previous version
- Confirm the revert action
- New version snapshot automatically created
- View updated question in history

### 3. Managing Question Status

**Question Status Lifecycle:**
```
Draft → Pending Review → Active
  ↓                        ↓
  └─────→ Archived ←───────┘
```

**Status Actions:**
- **Draft**: Initial status when creating questions
- **Pending Review**: Submit for approval (from edit form)
- **Active**: Approved questions available for use
- **Archived**: Soft-delete alternative (questions not deleted)

### 4. Protecting Questions

**Cannot Delete**:
- ❌ Active questions (blocked)
- ❌ Archived questions (blocked)
- Error message explains why

**Alternative: Archive Instead**
- ✅ Archive to soft-delete question
- ✅ Can revert from archive if needed
- ✅ Question not permanently removed

## File Format Reference

### CSV Import Format

**Required Columns**:
```csv
question_text,type,marks,difficulty
"Sample question here?",multiple_choice,1,easy
"Another question?",true_false,2,medium
"Complex question?",essay,5,hard
```

**Column Details**:
- `question_text`: The actual question (required, must be unique/not too similar to existing)
- `type`: multiple_choice, true_false, essay, short_answer, essay_short (required)
- `marks`: Numeric value for marks (required, must be > 0)
- `difficulty`: easy, medium, hard (required)

**Optional Columns** (MCQ questions):
- `option_1`, `option_2`, `option_3`, `option_4`: Answer options
- `correct_answer`: 1, 2, 3, or 4 (which option is correct)

### Example CSV File

```csv
question_text,type,marks,difficulty,option_1,option_2,option_3,option_4,correct_answer
"What is 2+2?",multiple_choice,1,easy,2,3,4,5,3
"True or False: Earth is round",true_false,1,easy,True,False,,2
"Explain photosynthesis",essay,5,hard,,,,
```

## Error Messages & Solutions

### Import Errors

**Error**: "No column 'question_text' found"
- **Solution**: Check CSV headers match exactly: question_text, type, marks, difficulty

**Error**: "Marks must be greater than 0"
- **Solution**: Ensure marks column has positive numbers only

**Error**: "Invalid question type: xyz"
- **Solution**: Use valid types: multiple_choice, true_false, essay, short_answer

**Error**: "Invalid difficulty: xyz"
- **Solution**: Use: easy, medium, hard

**Error**: "Possible duplicate detected"
- **Solution**: This is a warning (not blocking). Review similar questions before importing.

### Deletion/Archive Errors

**Error**: "Cannot delete active questions"
- **Solution**: Archive the question instead of deleting

**Error**: "Cannot delete archived questions"
- **Solution**: Permanently delete is blocked. Restore from archive or keep archived.

## Tips & Best Practices

### 1. Before Importing
- ✅ Validate CSV file structure
- ✅ Check marks and difficulty values
- ✅ Ensure no duplicate question text
- ✅ Test with 5-10 questions first

### 2. After Importing
- ✅ Review import summary
- ✅ Download error report if any failures
- ✅ Fix failed rows and re-import
- ✅ Edit questions for consistency

### 3. Managing Questions
- ✅ Use version history to track changes
- ✅ Archive questions instead of deleting
- ✅ Submit for review before activating
- ✅ Check activity logs for audit trail

### 4. Organizing Questions
- ✅ Use sections to group by topic/unit
- ✅ Use tags for cross-cutting themes
- ✅ Use difficulty levels for easy/medium/hard splits
- ✅ Use status to control availability

## Keyboard Shortcuts

- `Ctrl+U`: Open upload file dialog
- `Click History Icon`: View version history
- `Ctrl+Z` (on question): Revert to previous version

## Support

**Having Issues?**
1. Check the import error report (CSV download)
2. Review error messages for specific column problems
3. Validate file format matches CSV reference
4. Contact admin if questions appear blocked from deletion

**Need More Questions?**
1. Export existing questions (future feature)
2. Create bulk template (future feature)
3. Use import feature with your CSV file

## FAQ

**Q**: Can I edit imported questions?
**A**: Yes, click the pencil icon to edit any question. Changes create a new version.

**Q**: What happens if import partially fails?
**A**: Valid questions are inserted, failed rows are listed with error details. Download report to see all errors.

**Q**: Can I undo an import?
**A**: Delete individual questions or use archive. Bulk undo feature coming soon.

**Q**: How long do version histories keep?
**A**: Indefinitely. All versions are permanently stored for audit trail.

**Q**: Can I compare two versions side-by-side?
**A**: Yes, version modal shows field-by-field comparison automatically.

**Q**: What marks are questions worth?
**A**: You set marks when creating/importing. Each question can have different marks value.

---

**Last Updated**: December 2024
**Status**: Ready for Production Use
