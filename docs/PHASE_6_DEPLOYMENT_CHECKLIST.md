# Phase 6: Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [ ] All 4 new components created
  - [ ] QuestionFilters.tsx (150 lines)
  - [ ] BulkActionToolbar.tsx (120 lines)
  - [ ] QuestionTable.tsx (280 lines)
  - [ ] SectionGroup.tsx (300 lines)

- [ ] QuestionBank.tsx enhanced
  - [ ] New state added (selectedIds, filters, groupBySection)
  - [ ] Handler functions implemented
  - [ ] Components imported and rendered
  - [ ] ~110 lines of new code

- [ ] TypeScript compilation passes
  - [ ] `npm run build` succeeds
  - [ ] No type errors
  - [ ] No linting warnings

- [ ] No console errors/warnings
  - [ ] Browser console clean
  - [ ] Network tab shows no failed requests
  - [ ] React DevTools no warnings

### Phase 5 Prerequisites
- [ ] Phase 5 fully deployed and working
- [ ] Database migration applied (adds columns)
  - [ ] `order_index` field exists
  - [ ] `section_name` field exists
  - [ ] `difficulty` field exists
  - [ ] `status` field exists

- [ ] Phase 5 API endpoints working
  - [ ] POST /api/questions/bulk-delete ✓
  - [ ] POST /api/questions/bulk-status ✓
  - [ ] POST /api/questions/{id}/duplicate ✓
  - [ ] PATCH /api/questions/{id}/toggle-status ✓
  - [ ] GET /api/questions/{id}/preview ✓

### Testing Completed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance testing passed
- [ ] Responsive design verified
- [ ] Security review completed

---

## Environment Setup

### Development Environment
```bash
# Install dependencies
npm install

# Build project
npm run build

# Start dev server
npm run dev

# Verify no errors
npm run lint
```

### Staging Environment
```bash
# Same as development
# But against staging database
# And staging API endpoints
```

### Production Environment
```bash
# Production build
npm run build

# Production server
npm run start (or equivalent)

# Production database
# Production API endpoints
```

---

## File Deployment

### Step 1: Copy Component Files
```bash
# Copy to frontend/src/components/
cp QuestionFilters.tsx → frontend/src/components/
cp BulkActionToolbar.tsx → frontend/src/components/
cp QuestionTable.tsx → frontend/src/components/
cp SectionGroup.tsx → frontend/src/components/
```

**Verify**:
- [ ] All 4 files copied
- [ ] File sizes correct
- [ ] No corruption
- [ ] Correct permissions

### Step 2: Update QuestionBank.tsx
```bash
# Replace the file with enhanced version
cp QuestionBank.tsx → frontend/src/pages/admin/
```

**Verify**:
- [ ] File copied
- [ ] Imports correct
- [ ] No merge conflicts
- [ ] Compiles without errors

### Step 3: Build and Test
```bash
# Build with new files
npm run build

# Check for errors
npm run lint

# Start dev server
npm run dev

# Manual testing in browser
```

**Verify**:
- [ ] No TypeScript errors
- [ ] No build warnings
- [ ] Components load
- [ ] No console errors

---

## Database Verification

### Check Required Columns
```sql
-- Verify Phase 5 migration applied
DESCRIBE exam_questions;

-- Expected columns:
-- - id: bigint
-- - exam_id: bigint
-- - question_text: text
-- - question_type: varchar
-- - marks: int
-- - difficulty: varchar (from Phase 5)
-- - status: varchar (from Phase 5)
-- - section_name: varchar (from Phase 5)
-- - order_index: int (from Phase 5)
-- - created_at: timestamp
-- - updated_at: timestamp
```

### Check Sample Data
```sql
-- Verify data populated with Phase 5 fields
SELECT COUNT(*) FROM exam_questions;
SELECT COUNT(*) FROM exam_questions WHERE difficulty IS NOT NULL;
SELECT COUNT(*) FROM exam_questions WHERE status IS NOT NULL;
SELECT COUNT(*) FROM exam_questions WHERE section_name IS NOT NULL;

-- Should show: data exists in Phase 5 columns
```

### Check Indexes
```sql
-- Verify indexes for performance
SHOW INDEX FROM exam_questions;

-- Should include indexes on:
-- - exam_id
-- - question_type
-- - difficulty
-- - status
-- - section_name
```

---

## API Verification

### Test Phase 5 Endpoints
```bash
# Test bulk delete
curl -X POST http://localhost/api/questions/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{"question_ids": [1, 2, 3]}'

# Expected: { "message": "...", "deleted_count": 3 }

# Test bulk status
curl -X POST http://localhost/api/questions/bulk-status \
  -H "Content-Type: application/json" \
  -d '{"question_ids": [4, 5], "status": "active"}'

# Expected: { "message": "...", "updated_count": 2 }
```

**Verify All Endpoints**:
- [ ] GET /api/exams (list exams)
- [ ] GET /api/exams/{id}/questions (list questions)
- [ ] POST /api/questions (create)
- [ ] PUT /api/questions/{id} (update)
- [ ] DELETE /api/questions/{id} (delete)
- [ ] POST /api/questions/bulk-delete (bulk delete)
- [ ] POST /api/questions/bulk-status (bulk status)
- [ ] POST /api/questions/{id}/duplicate (duplicate)
- [ ] PATCH /api/questions/{id}/toggle-status (toggle)
- [ ] GET /api/questions/{id}/preview (preview)

---

## Functional Testing

### Smoke Tests (5 minutes)
1. [ ] Login to admin panel
2. [ ] Navigate to Question Bank
3. [ ] Select an exam
4. [ ] View question list (table visible)
5. [ ] Apply filter (filters work)
6. [ ] Select questions (checkboxes work)
7. [ ] Delete question (toolbar appears)
8. [ ] View by section (grouping works)
9. [ ] Edit question (modal opens)
10. [ ] Save question (API call succeeds)

### Integration Tests (15 minutes)
1. [ ] Create question
   - [ ] Appears in list
   - [ ] Has default values
   - [ ] Can be edited

2. [ ] Filter questions
   - [ ] Filters reduce results correctly
   - [ ] Multiple filters work together
   - [ ] Clear filters resets

3. [ ] Bulk operations
   - [ ] Select multiple questions
   - [ ] Delete multiple (confirmation works)
   - [ ] Update status for multiple

4. [ ] Section grouping
   - [ ] Groups by section_name
   - [ ] Shows statistics
   - [ ] Expand/collapse works

5. [ ] Quick actions
   - [ ] Preview opens
   - [ ] Duplicate creates copy
   - [ ] Edit opens modal
   - [ ] Toggle updates status
   - [ ] Delete removes item

### Edge Cases (10 minutes)
1. [ ] Empty exam (no questions)
2. [ ] All filtered out (no matches)
3. [ ] No section name (uses "General")
4. [ ] Large dataset (100+ questions)
5. [ ] Network errors (graceful failure)

---

## Performance Testing

### Load Time
- [ ] Initial page load: < 2 seconds
- [ ] Filter application: < 100ms
- [ ] Bulk operation: 1-5 seconds
- [ ] Selection toggle: < 10ms
- [ ] Scroll performance: Smooth (60fps)

### Browser Tools
```bash
# Lighthouse audit
# Verify:
# - Performance score > 80
# - Accessibility score > 90
# - Best Practices score > 90

# Chrome DevTools
# Memory: ~ 2-5MB for component
# CPU: No significant spikes
# Network: No 404s or failures
```

### Stress Test
- [ ] Load 500 questions
- [ ] Apply complex filters
- [ ] Select 100 questions
- [ ] Perform bulk delete
- [ ] Observe: No crashes, no lag

---

## Responsive Design Testing

### Desktop (1920x1080)
- [ ] All columns visible
- [ ] No horizontal scroll
- [ ] Toolbar properly positioned
- [ ] Filter panel expands fully

### Tablet (768x1024)
- [ ] Table scrollable
- [ ] Core columns visible
- [ ] Touch-friendly controls
- [ ] Responsive layout works

### Mobile (375x667)
- [ ] Compact layout
- [ ] All buttons clickable
- [ ] No text cutoff
- [ ] Scroll works smoothly

### Landscape (667x375)
- [ ] Layout adapts
- [ ] More content visible
- [ ] No overlapping elements

---

## Security Testing

### Authentication
- [ ] Unauthenticated users cannot access
- [ ] Can logout and back in
- [ ] Session persists across pages
- [ ] Tokens refresh correctly

### Authorization
- [ ] Non-admin cannot access admin features
- [ ] Cannot delete others' questions
- [ ] Cannot modify read-only fields
- [ ] Cannot access other exams' questions

### Input Validation
- [ ] Search input sanitized
- [ ] Filter inputs validated
- [ ] No XSS vulnerabilities
- [ ] No SQL injection possible

### API Security
- [ ] CSRF tokens validated
- [ ] Rate limiting respected
- [ ] Headers correct (CORS, CSP)
- [ ] No sensitive data in logs

---

## Browser Compatibility Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Test for Each Browser**:
- [ ] Components render
- [ ] All features work
- [ ] Styling correct
- [ ] No console errors
- [ ] Forms submit properly

---

## Rollback Plan

### If Critical Issues Found

**Step 1: Stop deployment**
- [ ] Pause all deployments
- [ ] Notify stakeholders
- [ ] Isolate affected systems

**Step 2: Revert code**
```bash
# Restore previous QuestionBank.tsx
git checkout previous-version -- frontend/src/pages/admin/QuestionBank.tsx

# Keep new component files (won't be used)
# Redeploy previous version

npm run build
npm run start
```

**Step 3: Restore data**
- [ ] Run migration rollback if needed
- [ ] Restore from backup if necessary
- [ ] Verify data integrity

**Step 4: Communicate**
- [ ] Notify users
- [ ] Update status page
- [ ] Provide timeline for fix

**Step 5: Debug and retest**
- [ ] Identify root cause
- [ ] Fix issue
- [ ] Extensive testing
- [ ] Redeploy

---

## Post-Deployment Tasks

### Immediate (First Hour)
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Monitor user activity
- [ ] Watch for support tickets

### Short-term (First Day)
- [ ] Verify all features working
- [ ] Check database for issues
- [ ] Review API call logs
- [ ] Gather initial user feedback

### Medium-term (First Week)
- [ ] Analyze usage patterns
- [ ] Collect performance data
- [ ] Fix any reported bugs
- [ ] Optimize as needed

### Long-term (Ongoing)
- [ ] Monitor for errors
- [ ] Track user engagement
- [ ] Plan Phase 6.1 features
- [ ] Gather feature requests

---

## Deployment Commands

### Build for Production
```bash
# Frontend
cd frontend
npm run build

# Output: dist/ folder
# Size check: should be < 5MB for app bundle
```

### Deploy to Server
```bash
# Option 1: Manual
cp -r dist/* /var/www/cbt-system/

# Option 2: Git
git push production main

# Option 3: CI/CD
# GitHub Actions, GitLab CI, or equivalent
# Trigger deployment pipeline
```

### Verify Deployment
```bash
# Check files on server
ls -la /var/www/cbt-system/

# Check permissions
stat /var/www/cbt-system/index.html

# Check web server
curl http://localhost/admin/questions
```

### Post-Deploy Verification
```bash
# Check app loads
curl -I http://production-url/admin

# Expected: HTTP 200 OK
# Headers: correct content-type, security headers

# Check API connectivity
curl http://production-url/api/exams

# Expected: JSON response with exams
```

---

## Documentation Deployment

- [ ] PHASE_6_IMPLEMENTATION_SUMMARY.md deployed
- [ ] PHASE_6_QUICK_REFERENCE.md deployed
- [ ] PHASE_6_UI_DISPLAY_IMPLEMENTATION.md deployed
- [ ] PHASE_6_TESTING_GUIDE.md deployed
- [ ] README updated with Phase 6 info
- [ ] API docs updated (if separate)

---

## Team Communication

### Before Deployment
- [ ] Notify development team
- [ ] Notify QA team
- [ ] Notify DevOps
- [ ] Notify product manager
- [ ] Notify support team

### Deployment Day
- [ ] Send deployment notice
- [ ] Provide rollback plan
- [ ] Establish on-call schedule
- [ ] Share monitoring links

### After Deployment
- [ ] Send success notification
- [ ] Share release notes
- [ ] Link to documentation
- [ ] Collect feedback

---

## Monitoring Setup

### Application Monitoring
- [ ] Error tracking (Sentry, etc.)
- [ ] Performance monitoring (APM)
- [ ] Log aggregation (ELK, etc.)
- [ ] Uptime monitoring

### Metrics to Watch
- [ ] Page load time
- [ ] API response times
- [ ] Error rate
- [ ] User activity
- [ ] Database queries

### Alerts to Configure
- [ ] High error rate (> 1%)
- [ ] Slow API responses (> 5s)
- [ ] Failed bulk operations
- [ ] Database connection issues
- [ ] Memory/CPU spikes

---

## Sign-Off Checklist

### Development
- [ ] Code reviewed
- [ ] All tests passed
- [ ] No known bugs
- [ ] Documentation complete
- [ ] DeveloperName: ________ Date: ________

### QA
- [ ] All test cases passed
- [ ] No critical issues
- [ ] Performance acceptable
- [ ] Security verified
- [ ] QAName: ________ Date: ________

### DevOps
- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Rollback plan tested
- [ ] Deployment script verified
- [ ] DevOpsName: ________ Date: ________

### Product/Project Manager
- [ ] Requirements met
- [ ] Stakeholders informed
- [ ] Release notes complete
- [ ] Documentation reviewed
- [ ] ManagerName: ________ Date: ________

---

## Final Deployment Approval

**Date**: ________________
**Time**: ________________
**Approver**: ________________
**Signed**: ________________

**Comments**:
```
[Any final notes or special instructions]
```

**Status**: ☐ APPROVED FOR DEPLOYMENT

---

## Deployment Record

**Deployment ID**: Phase6-20250101-001
**Deployed By**: [Name]
**Deployment Time**: [Date/Time]
**Deployed To**: [Production/Staging]
**Version**: [Git Hash or Tag]

**Files Deployed**:
- QuestionFilters.tsx ✓
- BulkActionToolbar.tsx ✓
- QuestionTable.tsx ✓
- SectionGroup.tsx ✓
- QuestionBank.tsx ✓

**Database Changes**:
- None (Phase 5 migration already applied)

**API Changes**:
- None (Phase 5 endpoints used)

**Issues During Deployment**:
```
[List any issues encountered]
```

**Resolution**:
```
[How issues were resolved]
```

**Rollback Status**: ☐ Not needed ☐ Performed

**Post-Deployment Status**: ✓ All systems operational

---

## Lessons Learned

**What Went Well**:
- Component modularization
- Clear responsibility separation
- Good TypeScript typing
- Comprehensive documentation

**What Could Be Improved**:
- Add pagination earlier in development
- Consider virtualization for large lists
- More granular loading states

**For Next Phase**:
- Build on Phase 6 foundation
- Implement Phase 6.1 features (pagination, sorting)
- Continue improving UX
- Monitor user feedback

---

**Deployment Checklist Complete**
**Next: Begin Phase 6.1 or wait for user feedback**
