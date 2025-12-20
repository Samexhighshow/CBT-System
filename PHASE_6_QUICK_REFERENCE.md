# Phase 6: Quick Reference Guide

## What Was Built

Four new React components and enhanced QuestionBank.tsx with advanced filtering, bulk operations, and section grouping.

## Files Created/Modified

### New Components
1. **QuestionFilters.tsx** (150 lines)
   - Collapsible filter panel
   - 4 dropdown filters: type, difficulty, status, section
   - Active filter count badge
   - Clear all button

2. **BulkActionToolbar.tsx** (120 lines)
   - Fixed bottom toolbar
   - Shows when items selected
   - Bulk delete & status update
   - Loading indicator

3. **QuestionTable.tsx** (280 lines)
   - Professional table layout
   - 9 columns with all question details
   - Row selection with checkboxes
   - Right-click context menu
   - Color-coded badges

4. **SectionGroup.tsx** (300 lines)
   - Collapsible section headers
   - Group questions by section
   - Section statistics (count, marks)
   - Nested table within section

### Modified Files
- **QuestionBank.tsx**: Enhanced with ~110 new lines
  - New state: selectedIds, filters, groupBySection
  - New handlers: bulk operations, filter changes
  - Component imports and integration
  - useMemo for performance optimization

## Key Features

### 1. Table Columns
```
☐ | # | Question Text | Type | Marks | Difficulty | Status | Section | Actions
```

### 2. Filters
- Question Type (all types from system)
- Difficulty (easy, medium, hard)
- Status (active, disabled, draft)
- Section (exam sections)

### 3. Bulk Operations
- Bulk Delete (with confirmation)
- Bulk Status Update (active/disabled/draft)
- Selection management (select all, clear all)

### 4. Section Grouping
- Automatic grouping by section_name
- Collapsible sections
- Section statistics
- Toggle "By Section" view on/off

### 5. Actions Per Question
- **Quick Actions** (row buttons):
  - Preview
  - Duplicate
  - Edit
  - Toggle Status
  - Delete

- **Context Menu** (right-click):
  - Same actions + separators
  - Better organization

## Usage Examples

### For Users

**Find hard questions:**
1. Open question bank
2. Click "Filters"
3. Select "Difficulty: Hard"
4. Table updates instantly

**Delete multiple questions:**
1. Check boxes for questions to delete
2. Bottom toolbar appears
3. Click "Delete Selected"
4. Confirm in dialog
5. Questions deleted

**Group by section:**
1. Click "By Section" toggle (top right)
2. Questions group under Part A, Part B, etc.
3. Click section header to expand/collapse
4. Click to select individual questions

### For Developers

**Add a new filter:**
```tsx
// In QuestionFilters.tsx, add to interface
interface FilterOptions {
  yourNewFilter: string;
}

// Add a dropdown in JSX
<select value={filters.yourNewFilter} onChange={...}>
  {options.map(opt => <option>{opt}</option>)}
</select>

// In QuestionBank.tsx, apply filter
if (filters.yourNewFilter) {
  result = result.filter(q => q.your_field === filters.yourNewFilter);
}
```

**Add a bulk operation:**
```tsx
// In BulkActionToolbar.tsx, add button
<button onClick={() => onBulkCustomAction()}>
  Custom Action
</button>

// In QuestionBank.tsx, add handler
const handleBulkCustomAction = async () => {
  await api.post('/questions/bulk-custom', {
    question_ids: Array.from(selectedIds),
  });
  loadQuestions();
};

// Pass to toolbar
<BulkActionToolbar
  onBulkCustomAction={handleBulkCustomAction}
/>
```

## Component APIs

### QuestionFilters
```tsx
<QuestionFilters 
  onFilterChange={(filters) => setFilters(filters)}
/>
```

### BulkActionToolbar
```tsx
<BulkActionToolbar
  selectedCount={selectedIds.size}
  onBulkDelete={handleBulkDelete}
  onBulkStatusUpdate={handleBulkStatusUpdate}
  onClearSelection={handleClearSelection}
  isLoading={bulkLoading}
/>
```

### QuestionTable
```tsx
<QuestionTable
  questions={filtered}
  selectedIds={selectedIds}
  onSelectChange={handleSelectChange}
  onEdit={openEdit}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
  onToggleStatus={handleToggleStatus}
  onPreview={handlePreview}
  isLoading={loading}
/>
```

### SectionGroup
```tsx
<SectionGroup
  section={section}
  selectedIds={selectedIds}
  onSelectChange={handleSelectChange}
  onEdit={openEdit}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
  onToggleStatus={handleToggleStatus}
  onPreview={handlePreview}
/>
```

## Database Changes

From Phase 5 migration, these columns exist:
- `order_index`: Question number in section
- `section_name`: Section name (Part A, Part B)
- `difficulty`: Question difficulty
- `status`: Question status

## API Endpoints Used

From Phase 5 (all ready to use):
```
POST   /api/questions/bulk-delete
POST   /api/questions/bulk-status
POST   /api/questions/{id}/duplicate
PATCH  /api/questions/{id}/toggle-status
GET    /api/questions/{id}/preview
```

## Performance Notes

- Filtering done client-side (fast, <100ms)
- Bulk operations use API (backend-safe)
- useMemo prevents unnecessary re-renders
- No pagination yet (add in Phase 6.1)

## Styling Details

### Colors
- Difficulty:
  - Easy: Green (#10B981)
  - Medium: Yellow (#F59E0B)
  - Hard: Red (#EF4444)
  
- Status:
  - Active: Green (#10B981)
  - Disabled: Red (#EF4444)
  - Draft: Blue (#3B82F6)

### Layout
- Table: Responsive, scrolls horizontally on mobile
- Toolbar: Fixed bottom, appears only when needed
- Filters: Collapsible, saves space
- Sections: Gradient headers with icons

## Testing Checklist

- [ ] All filters work independently
- [ ] Filters work in combination
- [ ] Select all / clear all work
- [ ] Bulk delete removes correct items
- [ ] Bulk status update applies to all selected
- [ ] Section toggle shows/hides sections
- [ ] Section select all selects only that section
- [ ] Context menu appears on right-click
- [ ] Mobile responsive (test on phone)
- [ ] No console errors
- [ ] API calls successful

## Common Tasks

### Clear filters
Click "Clear Filters" in filter panel or filter individual dropdowns

### Search while filtered
Type in search box - works with active filters

### Undo a bulk operation
Currently not supported, but can reload page (Ctrl+R)
Future: Add undo/redo in Phase 6.2

### Export selected questions
Not yet implemented, planned for Phase 6.1

### Reorder questions
Use order_index field, planned drag-drop for Phase 6.1

## Troubleshooting

**Toolbar doesn't appear:**
- Ensure checkboxes are being checked
- Check browser console for errors
- Verify selectedIds state is updating

**Filters don't work:**
- Verify database columns exist (order_index, difficulty, status, section_name)
- Check API returns these fields
- Look at network tab for data

**Sections not showing:**
- Ensure section_name field is populated
- Check database for NULL values
- Use "All" view to verify data exists

**Performance slow:**
- Check how many questions (>500?)
- Add pagination in Phase 6.1
- Clear filters to reduce rendering

## Next Steps

### Phase 6.1 (Planned)
- Pagination for large datasets
- Column sorting
- Drag-drop reordering
- Export selected questions

### Phase 6.2 (Planned)
- Advanced search patterns
- Undo/redo for operations
- Question cloning (section-level)
- Import from other exams

## Support

For issues or questions:
1. Check documentation: PHASE_6_UI_DISPLAY_IMPLEMENTATION.md
2. Review component code comments
3. Test in browser DevTools
4. Check API responses in Network tab
5. Review Phase 5 docs for backend context

## Version Info

- **Phase**: 6 (UI & Display)
- **Status**: Core Implementation Complete
- **Components**: 4 new (Table, Filters, Toolbar, SectionGroup)
- **Files Modified**: 1 (QuestionBank.tsx)
- **Lines of Code**: ~750 new lines
- **Test Coverage**: Ready for QA
