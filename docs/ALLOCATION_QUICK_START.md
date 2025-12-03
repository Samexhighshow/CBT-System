# Allocation Engine - Quick Start Guide

## Installation (One-Time Setup)

```bash
# 1. Navigate to backend
cd backend

# 2. Run migrations
php artisan migrate

# 3. Seed test data (optional)
php artisan db:seed --class=AllocationTestSeeder

# 4. Start queue worker (for async processing)
php artisan queue:work
```

## Common Tasks

### Create an Exam Hall

**Via API:**
```bash
curl -X POST http://localhost:8000/api/halls \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Hall A",
    "rows": 10,
    "columns": 8,
    "teachers_needed": 3,
    "notes": "Air-conditioned"
  }'
```

**Via UI:**
1. Navigate to Admin → Hall Management
2. Click "Add Hall"
3. Fill in grid dimensions (rows × columns)
4. Set teacher requirements
5. Save

### Assign Teachers to Hall

**Via API:**
```bash
curl -X POST http://localhost:8000/api/halls/1/assign-teachers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "teachers": [
      {"teacher_id": 5, "role": "chief_invigilator"},
      {"teacher_id": 8, "role": "invigilator"},
      {"teacher_id": 12, "role": "invigilator"}
    ]
  }'
```

**Via UI:**
1. Navigate to Admin → Teacher Assignment
2. Select exam
3. For each hall, click "Add Teacher"
4. Select teacher and role
5. Click "Save All Assignments"

### Generate Seat Allocation

**Via API (Synchronous):**
```bash
curl -X POST http://localhost:8000/api/allocations/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "mode": "auto",
    "seat_numbering": "row_major",
    "adjacency_strictness": "strict",
    "shuffle_seed": "my-seed-123",
    "async": false
  }'
```

**Via API (Asynchronous - for large exams):**
```bash
curl -X POST http://localhost:8000/api/allocations/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "async": true
  }'

# Check status
curl http://localhost:8000/api/allocations/status/{runId}
```

**Via UI:**
1. Navigate to Admin → Allocation Generator
2. Select exam from dropdown
3. Choose mode (Auto recommended)
4. Expand "Advanced Options" (optional):
   - Set seat numbering strategy
   - Adjust adjacency strictness
   - Enable async for >500 students
5. Click "Generate Allocation"

### View Seating Chart

**Via API:**
```bash
# Get grid layout
curl http://localhost:8000/api/halls/1/grid-layout?allocation_run_id=42

# Get run details
curl http://localhost:8000/api/allocations/run/42
```

**Via UI:**
1. Navigate to Admin → Allocation History
2. Select exam
3. Click "View" on desired run
4. Use hall tabs to switch between halls
5. Filter by class if needed

### Check Student's Seat

**Via API:**
```bash
curl http://localhost:8000/api/allocations/my-seat/1 \
  -H "Authorization: Bearer STUDENT_TOKEN"
```

**Via UI (Student View):**
1. Student logs in
2. Navigates to "My Exams"
3. Clicks on exam
4. Views "My Seat Allocation"
5. Can print allocation slip

### Export Results

**PDF Export:**
```bash
# Download PDF
curl -O http://localhost:8000/api/allocations/export/pdf/42 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Excel Export:**
```bash
# Download Excel
curl -O http://localhost:8000/api/allocations/export/excel/42 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Via UI:**
1. Open allocation viewer
2. Click "Export PDF" or "Export Excel" button
3. File downloads automatically

### Regenerate with Different Seed

**Via API:**
```bash
curl -X POST http://localhost:8000/api/allocations/regenerate/42 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shuffle_seed": "new-seed-456"
  }'
```

**Via UI:**
1. Open allocation viewer or history
2. Click "Regenerate" button
3. Confirm action
4. New run created with different random pattern

### Manual Seat Reassignment

**Via API:**
```bash
curl -X POST http://localhost:8000/api/allocations/reassign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allocation_id": 123,
    "new_hall_id": 2,
    "new_row": 5,
    "new_column": 3
  }'
```

**Via UI:**
*Coming soon - drag-and-drop interface*

### View Conflicts

**Via API:**
```bash
curl http://localhost:8000/api/allocations/conflicts/42
```

**Via UI:**
1. Open allocation viewer
2. Scroll to "Adjacency Conflicts" section
3. View conflict details (students, positions, class)
4. Check resolution status

## Configuration Options

### Mode
- **auto**: Fully automated (recommended)
- **manual**: User provides seed and settings

### Seat Numbering
- **row_major**: Seats numbered left-to-right, top-to-bottom (1, 2, 3...)
- **column_major**: Seats numbered top-to-bottom, left-to-right (1, 9, 17...)

### Adjacency Strictness
- **strict**: Maximum separation, aggressive conflict resolution
- **moderate**: Balanced approach (default)
- **lenient**: Allow some same-class adjacency

## Quick Troubleshooting

### Problem: "Insufficient capacity"
**Solution:** 
- Add more halls or increase hall dimensions
- Reduce number of enrolled students

### Problem: "Too many conflicts"
**Solution:**
- Change shuffle seed (try different random pattern)
- Use stricter adjacency mode
- Increase hall capacity

### Problem: "Allocation not visible"
**Solution:**
- Check allocation_run.completed_at is set
- Verify student is enrolled in exam
- Ensure hall is marked as active

### Problem: "Queue job stuck"
**Solution:**
```bash
# Check queue
php artisan queue:work --once

# View failed jobs
php artisan queue:failed

# Retry all
php artisan queue:retry all
```

## Testing Commands

```bash
# Run all tests
php artisan test

# Test allocation generation
php artisan tinker
>>> $run = \App\Services\AllocationEngine::execute(1, 'test-seed-123')

# Check statistics
>>> \App\Models\AllocationRun::latest()->first()->metadata

# View sample allocation
>>> \App\Models\Allocation::with('student','hall')->take(5)->get()

# Count conflicts
>>> \App\Models\SeatConflict::where('resolved', false)->count()
```

## Performance Tips

1. **Use async mode for >500 students**
   ```json
   {"async": true}
   ```

2. **Optimize hall sizes** (8-12 rows × 8-10 columns ideal)

3. **Batch operations** - Use queue worker for multiple exams

4. **Clear old runs** periodically:
   ```bash
   php artisan tinker
   >>> \App\Models\AllocationRun::where('created_at', '<', now()->subMonths(3))->delete()
   ```

## API Authentication

All requests require a Bearer token:

```bash
# Login first
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use returned token in subsequent requests
export TOKEN="your_token_here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/halls
```

## Common Workflows

### Setup New Exam

1. Create exam in system
2. Enroll students
3. Create/verify halls (Admin → Hall Management)
4. Assign teachers (Admin → Teacher Assignment)
5. Generate allocation (Admin → Allocation Generator)
6. Review seating chart (Admin → Allocation Viewer)
7. Export and distribute

### Day of Exam

1. Print seating charts (PDF export)
2. Print individual slips (Excel export)
3. Students check their seats (Student Dashboard)
4. Teachers verify assignments
5. Manual adjustments if needed

### Post-Exam

1. Review allocation statistics
2. Archive allocation run
3. Export for records
4. Prepare for next exam

## Need Help?

- 📖 Full documentation: `docs/ALLOCATION_ENGINE.md`
- 🐛 Report issues: Project repository
- 💬 Ask questions: Development team

---

**Version:** 1.0.0  
**Last Updated:** December 2025
