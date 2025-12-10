# Git Collaboration Workflow - CBT System

## Branch Structure

### 🔒 MAIN BRANCH (Protected)
- **Purpose**: Production-ready code only
- **Protection**: No direct pushes allowed
- **Updates**: Only through Pull Requests after review

### 👑 TEAMLEAD-DEV BRANCH (Your Workspace)
- **Purpose**: Team lead's development workspace
- **Owner**: You (Team Lead)
- **Workflow**: 
  - Pull from main regularly
  - Write and test code
  - Commit changes
  - Create Pull Requests to main
  - Review and merge other team members' PRs

### 👥 Team Member Branches (e.g., mavis-dev)
- **Purpose**: Individual developer workspaces
- **Naming**: `[name]-dev` (e.g., `mavis-dev`, `john-dev`)
- **Workflow**:
  - Pull from main regularly
  - Write and test code
  - Commit changes
  - Create Pull Requests to main
  - Wait for team lead approval

---

## 📋 Workflow for YOU (Team Lead)

### 1️⃣ Starting Your Work
```bash
# Make sure you're on your branch
git checkout teamlead-dev

# Pull latest changes from main
git pull origin main

# Start coding!
```

### 2️⃣ Committing Your Changes
```bash
# Check what changed
git status

# Add files
git add .
# OR add specific files
git add frontend/src/pages/SomePage.tsx

# Commit with clear message
git commit -m "feat: add student registration improvements"

# Push to your branch
git push origin teamlead-dev
```

### 3️⃣ Creating a Pull Request (Merge to Main)
1. Go to GitHub repository
2. Click "Pull Requests" → "New Pull Request"
3. Base: `main` ← Compare: `teamlead-dev`
4. Add description of changes
5. Create Pull Request
6. **As team lead, you can review and merge your own PR** (after testing)

### 4️⃣ Reviewing Team Members' Pull Requests
```bash
# Option 1: Review on GitHub
- Go to "Pull Requests" tab
- Click on the PR
- Review code changes
- Add comments if needed
- Approve or Request changes
- Click "Merge" when ready

# Option 2: Test locally before merging
git fetch origin
git checkout mavis-dev  # Check out team member's branch
# Test their code
git checkout teamlead-dev  # Go back to your branch
```

### 5️⃣ Resolving Merge Conflicts (If Any)
```bash
# Pull latest main
git checkout main
git pull origin main

# Go to your branch
git checkout teamlead-dev

# Merge main into your branch
git merge main

# If conflicts occur:
# 1. Open conflicted files
# 2. Look for <<<<<<< markers
# 3. Resolve conflicts manually
# 4. Remove conflict markers
# 5. Test the code

git add .
git commit -m "merge: resolve conflicts with main"
git push origin teamlead-dev
```

---

## 📋 Workflow for TEAM MEMBERS

### Setup (First Time Only)
```bash
# Create their development branch
git checkout -b [name]-dev
# Example: git checkout -b mavis-dev

# Push branch to remote
git push -u origin [name]-dev
```

### Daily Workflow
```bash
# 1. Start of day - get latest code
git checkout mavis-dev
git pull origin main

# 2. Work on features
# ... code changes ...

# 3. Commit changes
git add .
git commit -m "feat: description of changes"

# 4. Push to their branch
git push origin mavis-dev

# 5. Create Pull Request on GitHub
# Base: main ← Compare: mavis-dev
# Request review from team lead

# 6. Wait for approval and merge by team lead
```

---

## 🚀 Common Git Commands Reference

### Branch Management
```bash
# List all branches
git branch -a

# Create new branch
git branch new-branch-name

# Switch to branch
git checkout branch-name

# Create and switch in one command
git checkout -b new-branch-name

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name
```

### Syncing Code
```bash
# Get latest from remote
git fetch origin

# Pull latest from main
git pull origin main

# Push your changes
git push origin your-branch-name

# Force push (use carefully!)
git push -f origin your-branch-name
```

### Viewing Changes
```bash
# See what files changed
git status

# See actual changes
git diff

# See commit history
git log --oneline

# See who changed what
git blame filename
```

### Undoing Changes
```bash
# Undo uncommitted changes to a file
git checkout -- filename

# Undo all uncommitted changes
git reset --hard

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Undo a pushed commit (create new commit)
git revert commit-hash
```

---

## 📝 Commit Message Best Practices

### Format
```
type: brief description

Detailed explanation if needed
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code formatting (no logic change)
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Examples
```bash
git commit -m "feat: add student registration form validation"
git commit -m "fix: resolve pagination issue on admin dashboard"
git commit -m "docs: update API documentation for exam endpoints"
git commit -m "refactor: optimize allocation algorithm performance"
```

---

## 🔄 Pull Request Best Practices

### Creating a Good PR
1. **Clear Title**: Summarize the changes
2. **Description**: Explain what and why
3. **Screenshots**: For UI changes
4. **Testing**: Mention what you tested
5. **Related Issues**: Link to GitHub issues if any

### PR Template
```markdown
## What Changed?
Brief description of changes

## Why?
Reason for the changes

## How to Test?
1. Step 1
2. Step 2
3. Expected result

## Screenshots (if UI changes)
[Attach images]

## Checklist
- [ ] Code tested locally
- [ ] No console errors
- [ ] Mobile responsive (if frontend)
- [ ] Documentation updated
```

---

## 🛡️ Protected Main Branch Rules

### As Team Lead, You Should:
1. ✅ **Never push directly to main**
2. ✅ **Always use Pull Requests**
3. ✅ **Review all team members' PRs carefully**
4. ✅ **Test code before merging**
5. ✅ **Resolve conflicts before merging**
6. ✅ **Keep main branch stable and deployable**

### Setting Up Branch Protection (on GitHub)
1. Go to Repository Settings
2. Branches → Branch protection rules
3. Add rule for `main` branch:
   - ✓ Require pull request before merging
   - ✓ Require approvals (at least 1)
   - ✓ Dismiss stale PR approvals
   - ✓ Require status checks to pass
   - ✓ Include administrators (even you must follow rules)

---

## 🚨 Emergency Procedures

### Accidentally Pushed to Main
```bash
# If you pushed but haven't shared with team yet
git reset --hard HEAD~1  # Undo commit
git push -f origin main   # Force push (dangerous!)

# If team already pulled
# Contact team, coordinate reverting
```

### Need to Undo a Merged PR
```bash
# Find the merge commit
git log --oneline

# Revert the merge
git revert -m 1 merge-commit-hash

# Push the revert
git push origin main
```

### Lost Work / Need to Recover
```bash
# See all recent commits (even deleted ones)
git reflog

# Restore to a specific state
git reset --hard commit-hash
```

---

## 👥 Team Collaboration Tips

### Daily Standup Checklist
- [ ] Pulled latest main this morning
- [ ] Committed yesterday's work
- [ ] Pushed to my dev branch
- [ ] Created PR if feature is ready
- [ ] Reviewed assigned PRs
- [ ] No merge conflicts in my branch

### Communication
- **Slack/Discord**: Announce when PR is ready
- **PR Comments**: Use for code-specific discussions
- **GitHub Issues**: Track bugs and features
- **Wiki**: Document architecture decisions

### Avoid Merge Conflicts
1. Pull from main frequently (at least daily)
2. Communicate when working on same files
3. Keep PRs small and focused
4. Merge PRs quickly once approved

---

## 📊 Current Repository Status

### Active Branches
- `main` - Protected, production-ready
- `teamlead-dev` - Your workspace ✅ (currently checked out)

### Next Steps for Team
1. Team members create their dev branches
2. Everyone pulls latest main daily
3. Work on features in dev branches
4. Create PRs when ready
5. You review and merge PRs
6. Keep main branch stable

---

## 🎯 Quick Reference Card

```bash
# DAILY ROUTINE (Team Lead)
git checkout teamlead-dev     # Switch to your branch
git pull origin main          # Get latest code
# ... do your work ...
git add .                     # Stage changes
git commit -m "feat: ..."     # Commit
git push origin teamlead-dev  # Push to remote

# CREATE PR
# Go to GitHub → Pull Requests → New PR
# Base: main ← Compare: teamlead-dev

# REVIEW TEAM PR
# GitHub → Pull Requests → [PR name]
# Review → Approve → Merge

# SYNC WITH MAIN
git checkout main
git pull origin main
git checkout teamlead-dev
git merge main
```

---

## 📞 Need Help?

### Git Resources
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Git Visual Guide](https://marklodato.github.io/visual-git-guide/index-en.html)

### Common Issues
- **Merge conflicts**: Ask for help, don't force push
- **Lost commits**: Check `git reflog`
- **Wrong branch**: `git stash`, switch branch, `git stash pop`

---

**Remember**: The main branch represents your production code. Keep it clean, tested, and deployable! 🚀
