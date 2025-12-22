# Question Randomization - Integration Guide

## Step-by-Step Integration into ExamManagement

### Option 1: Add Button to Dropdown Menu (Recommended)

**File**: `frontend/src/pages/admin/ExamManagement.tsx`

**Location**: After "Add Questions" button in the dropdown menu (around line 796)

**Code to Add**:

```tsx
{/* Configure Question Randomization */}
<button
  onClick={() => {
    setSelectedExamForRandomization(exam.id);
    setShowRandomizationModal(true);
  }}
  className="w-full text-left px-4 py-3 text-sm text-indigo-700 hover:bg-indigo-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
>
  <i className='bx bx-shuffle text-indigo-500'></i>
  <span className="font-medium">Configure Randomization</span>
</button>
```

**State to Add** (near line 90):

```tsx
const [showRandomizationModal, setShowRandomizationModal] = useState(false);
const [selectedExamForRandomization, setSelectedExamForRandomization] = useState<number | null>(null);
```

**Modal Component to Add** (before closing return statement, around line 1200):

```tsx
{/* Question Randomization Modal */}
{showRandomizationModal && selectedExamForRandomization && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Configure Question Randomization
        </h2>
        <button
          onClick={() => {
            setShowRandomizationModal(false);
            setSelectedExamForRandomization(null);
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          <i className='bx bx-x text-2xl'></i>
        </button>
      </div>
      <div className="p-6">
        <QuestionRandomization 
          examId={selectedExamForRandomization}
          onClose={() => {
            setShowRandomizationModal(false);
            setSelectedExamForRandomization(null);
            loadExams(); // Refresh exam list
          }}
        />
      </div>
    </div>
  </div>
)}
```

**Import to Add** (at top of file, after other imports):

```tsx
import { QuestionRandomization } from '../../components/exams/QuestionRandomization';
```

---

### Option 2: Add Dedicated Tab

If you prefer a separate UI for randomization configuration, add a "Randomization" button next to the edit button:

**Location**: Replace the three-button group (Edit, Dropdown, Delete) with expanded buttons

**Code**:

```tsx
{/* Actions Container */}
<div className="flex items-center justify-end gap-1.5">
  {/* Edit */}
  <button
    onClick={() => handleEdit(exam)}
    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200 transform hover:scale-110"
    title="Edit exam"
  >
    <i className='bx bx-edit text-base'></i>
  </button>

  {/* Randomization */}
  <button
    onClick={() => {
      setSelectedExamForRandomization(exam.id);
      setShowRandomizationModal(true);
    }}
    className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all duration-200 transform hover:scale-110"
    title="Configure randomization"
  >
    <i className='bx bx-shuffle text-base'></i>
  </button>

  {/* More Actions Dropdown */}
  {/* ... existing dropdown code ... */}

  {/* Delete */}
  <button
    onClick={() => handleDeleteExam(exam)}
    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 transform hover:scale-110"
    title="Delete exam"
  >
    <i className='bx bx-trash text-base'></i>
  </button>
</div>
```

---

## Moving QuestionRandomization Component

The `QuestionRandomization.tsx` component is currently at:

**Current Location:**
```
frontend/src/components/QuestionRandomization.tsx
```

**Should be moved to:**
```
frontend/src/components/exams/QuestionRandomization.tsx
```

Or keep as-is and update import to:
```tsx
import { QuestionRandomization } from '../../components/QuestionRandomization';
```

---

## Required Props for QuestionRandomization

```typescript
interface QuestionRandomizationProps {
  examId: number;
  onClose?: () => void;  // Called when modal should close
}
```

The component automatically:
- Loads exam randomization settings on mount
- Calls API endpoints to save changes
- Shows error/success notifications
- Shows lock status and prevents changes if locked

---

## API Endpoints Used

The QuestionRandomization component calls these endpoints:

1. **GET** `/exams/{id}/randomization/stats` - Load current settings
2. **PUT** `/exams/{id}/randomization` - Save settings
3. **GET** `/exams/{id}/randomization/preview` - Generate preview
4. **POST** `/exams/{id}/randomization/lock` - Lock questions
5. **POST** `/exams/{id}/randomization/unlock` - Unlock questions

All endpoints are already implemented in the backend.

---

## Testing After Integration

1. **Navigate to Exam Management** (`/admin/exams`)
2. **Click Edit on any exam** or **Click the Randomization button**
3. **Configure Settings**:
   - Select Random mode
   - Set total questions (e.g., 30)
   - Choose difficulty distribution (e.g., 10 easy, 15 medium, 5 hard)
   - Enable shuffling if desired
4. **Generate Preview** to validate
5. **Lock Questions** when satisfied
6. **Verify** questions are locked (button shows "Unlock")

---

## Troubleshooting Integration Issues

### Issue: Component not found error
**Solution**: Ensure `QuestionRandomization.tsx` exists in `frontend/src/components/` or update import path

### Issue: API endpoints not found (404)
**Solution**: Verify routes are registered in `backend/routes/api.php`:
```bash
php artisan route:list | grep randomization
```

### Issue: TypeScript errors in component
**Solution**: Run TypeScript compiler to check:
```bash
cd frontend
npm run build
```

### Issue: Modal won't close after saving
**Solution**: Ensure `onClose` callback is called in component and parent state is updated

---

## Customization Options

### Change Icon
Replace `bx-shuffle` with any BoxIcons icon:
- `bx-sliders` - Settings icon
- `bx-random` - Randomization icon
- `bx-git-branch` - Branch/split icon

### Change Color Scheme
Replace `indigo` with `purple`, `blue`, `violet`, etc. in button classes

### Position in Dropdown
Move the "Configure Randomization" button before/after other options by changing its position in the dropdown menu

### Add Keyboard Shortcut
Add to useKeyboardShortcuts hook:
```tsx
{ key: 'r', handler: () => { /* open randomization */ } }
```

---

## User Guide Text

When adding UI elements, include this help text:

**"Configure Question Randomization"** button description:
> Choose how to select questions for this exam. Serve a subset of questions from your bank, distribute by difficulty/marks, shuffle for fairness, and ensure unique questions per student to prevent cheating.

---

## Next Steps

1. ✅ Backend implemented (routes, service, controller, models)
2. ✅ Frontend component created (QuestionRandomization.tsx)
3. 🔄 **Integrate into ExamManagement page** ← You are here
4. Update exam attempt logic to use randomized questions
5. Test end-to-end with real exams
6. Deploy to production

