# Publish/Unpublish Fix - Exam Status Update

## Problem

When an exam was unpublished, the status badge in the UI would still show "Scheduled" even though the exam was hidden from students. This was confusing because:

1. User would click "Unpublish" button on a "Scheduled" exam
2. Success message would show "Exam unpublished"
3. But the UI would still show the "Scheduled" badge
4. Making it unclear whether the unpublish actually worked

## Root Cause

The issue was a separation of concerns between two fields in the database:

- `status` field: Tracks the lifecycle state (draft → scheduled → active → completed)
- `published` field: Boolean indicating if the exam is visible to students

**Old Logic:**
```
handleUnpublish() {
  await api.put(`/exams/${exam.id}`, {
    published: false,
    status: exam.status,  // ← PROBLEM: Keeps old status
  });
}
```

This would set `published=false` but leave `status='scheduled'`. The UI only displayed the `status` field, so the exam appeared to still be "Scheduled" even though it was unpublished.

## Solution

Changed both frontend and backend to transition the exam back to 'draft' status when unpublishing:

### Frontend Change (ExamManagement.tsx)

```typescript
const handleUnpublish = async (exam: ExamRow) => {
  try {
    await api.put(`/exams/${exam.id}`, {
      published: false,
      status: 'draft',  // ← FIX: Transition back to draft
    });
    showSuccess('Exam unpublished - moved back to draft');
    loadExams();
  } catch (error) {
    showError('Unpublish failed');
  }
};
```

### Backend Change (ExamController.php)

Updated the lifecycle validation to allow draft transitions when unpublishing:

```php
// Allow reverting to draft when unpublishing (published=false)
// But prevent reverting to draft if only changing status without unpublishing
$isUnpublishing = !$newPublished && $exam->published;
if ($currentStatus !== 'draft' && $newStatus === 'draft' && !$isUnpublishing) {
    return response()->json([
        'message' => 'Cannot revert a non-draft exam back to draft',
        'errors' => ['status' => ['Invalid lifecycle transition']]
    ], 422);
}
```

This allows:
- ✓ `scheduled` → `draft` when `published=true` → `published=false`
- ✓ `active` → `draft` when `published=true` → `published=false`
- ✗ `scheduled` → `draft` when `published=true` → `published=true` (invalid)
- ✗ `completed` → `draft` even when unpublishing (completed exams stay completed)

## Exam Lifecycle After Fix

```
┌─────────────────────────────────────────────────────────┐
│                    Exam Lifecycle                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [DRAFT] ─────(Publish)────→ [SCHEDULED]               │
│    ↑                              │                      │
│    │                              │                      │
│    └──(Unpublish)─────────────────┤                     │
│                                    │                     │
│                           (Start time)                    │
│                              ↓                            │
│                           [ACTIVE]                        │
│                              │                            │
│                           (Close)                         │
│                              ↓                            │
│                        [COMPLETED]                        │
│                                                          │
│  Status Displayed: Shown in admin UI                     │
│  Published Flag: Controls visibility to students         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Expected UI Behavior

| Status | Published | Visible to Students | UI Badge | Can Publish | Can Unpublish |
|--------|-----------|---------------------|----------|-------------|---------------|
| draft | false | ✗ No | "Draft" | ✓ Yes | ✗ No |
| scheduled | true | ✓ Yes | "Scheduled" | ✗ No | ✓ Yes |
| active | true | ✓ Yes | "Active" | ✗ No | ✓ Yes |
| completed | true | ✗ No | "Completed" | ✗ No | ✗ No |
| cancelled | false | ✗ No | "Cancelled" | ✗ No | ✗ No |

## Test Results

✓ Status transitions work correctly:
- draft (pub:F) → scheduled (pub:T) - ALLOWED (publishing)
- scheduled (pub:T) → draft (pub:F) - ALLOWED (unpublishing)
- scheduled (pub:T) → active (pub:T) - ALLOWED (starting exam)
- completed (pub:T) → draft (pub:F) - BLOCKED (can't change completed exams)

## Files Modified

1. **frontend/src/pages/admin/ExamManagement.tsx** (line 410-421)
   - Updated `handleUnpublish()` to set `status: 'draft'`

2. **backend/app/Http/Controllers/Api/ExamController.php** (line 306-312)
   - Updated lifecycle validation to allow draft transitions when unpublishing

## Testing Steps

1. Create an exam (status: draft, published: false)
2. Publish it (status: scheduled, published: true) → UI shows "Scheduled"
3. Unpublish it (status: draft, published: false) → UI now shows "Draft"
4. Verify the exam is hidden from the student dashboard
5. Publish it again to confirm the cycle works

## Verification Checklist

- [x] Frontend sends `status: 'draft'` when unpublishing
- [x] Backend accepts draft transition when unpublishing
- [x] UI displays correct status badge after unpublish
- [x] Exam is hidden from students after unpublish
- [x] Can re-publish unpublished exams
- [x] Completed exams cannot be unpublished back to draft
