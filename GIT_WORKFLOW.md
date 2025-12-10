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

## 🔄 **Advanced Workflow - Multi-Branch Collaboration**

### **Scenario: Pull from Collaborator + Push Your Changes + Merge Both to Main**

#### **Step 1️⃣: Check Out Your Branch**
```bash
# Switch to your team lead branch
git checkout teamlead-dev

# Make sure it's up to date with main
git pull origin main
```

#### **Step 2️⃣: Pull Changes from Your Collaborator's Branch**
```bash
# Fetch all remote branches (updates your local copy of remote branches)
git fetch origin

# Check what branches are available
git branch -a

# You'll see:
# * teamlead-dev
#   remotes/origin/main
#   remotes/origin/mavis-dev
#   remotes/origin/john-dev
#   etc.

# Now merge your collaborator's branch INTO your branch
# (This brings their code into your workspace to test together)
git merge origin/mavis-dev

# If there are conflicts:
# 1. VS Code will show conflict markers
# 2. Manually resolve the conflicts
# 3. Accept their changes, your changes, or both
# 4. Then:
git add .
git commit -m "merge: integrate mavis-dev changes into teamlead-dev"
```

#### **Step 3️⃣: Make Your Own Changes (if needed)**
```bash
# Edit your files
# ... code changes ...

# Stage and commit
git add .
git commit -m "feat: add your feature improvements"

# Or modify their code if you found issues
git add .
git commit -m "fix: resolve issues in merged code from mavis-dev"
```

#### **Step 4️⃣: Push Your Branch to Remote**
```bash
# Push your teamlead-dev branch with all the merged code
git push origin teamlead-dev
```

#### **Step 5️⃣: Now You Have Options**

**Option A: Merge teamlead-dev to main (after testing)**
```bash
# Create a Pull Request on GitHub
# Base: main ← Compare: teamlead-dev
# This PR will include both your code AND mavis-dev's code

# Or merge directly if you prefer:
git checkout main
git pull origin main
git merge teamlead-dev
git push origin main
```

**Option B: Create a Clean Pull Request for the Collaborator's Code**
```bash
# If you want to keep the original PR from mavis-dev clean
# Go to GitHub and merge their original PR: mavis-dev → main

# This keeps each developer's work traceable in git history
```

---

### **Real-World Example Workflow**

```bash
# ============================================
# 1. You start your day
# ============================================
git checkout teamlead-dev
git pull origin main
# You now have latest code from main

# ============================================
# 2. Collaborator (Mavis) finishes her feature
# She pushes: mavis-dev → origin/mavis-dev
# ============================================

# ============================================
# 3. You want to test her code with yours
# ============================================
git fetch origin                    # Get latest from remote
git merge origin/mavis-dev          # Merge her code into your branch
# Now you have both your code + her code in one branch

# ============================================
# 4. Test together (run the app, check for bugs)
# ============================================
# npm start  (in another terminal)
# Test...

# ============================================
# 5. You fix issues in the merged code
# ============================================
git add .
git commit -m "fix: resolve issues in merged mavis-dev code"

# ============================================
# 6. Push your branch with everything
# ============================================
git push origin teamlead-dev

# ============================================
# 7. Now merge to main (two ways)
# ============================================

# WAY 1: Create a single PR with everything
# GitHub → New PR → Base: main ← Compare: teamlead-dev
# This includes your code + mavis's code + your fixes
# Click Merge

# WAY 2: Keep each person's work separate
# Let mavis create her own PR: mavis-dev → main
# You create your PR: teamlead-dev → main
# You merge both PRs to main separately
# This keeps git history cleaner per developer
```

---

### **Multiple Collaborators - Merge Several Branches**

```bash
# If you want to integrate code from MULTIPLE team members:

git checkout teamlead-dev
git pull origin main

# Pull from first collaborator
git merge origin/mavis-dev
# Fix any conflicts
git add .
git commit -m "merge: integrate mavis-dev"

# Pull from second collaborator
git merge origin/john-dev
# Fix any conflicts
git add .
git commit -m "merge: integrate john-dev"

# Pull from third collaborator
git merge origin/sarah-dev
# Fix any conflicts
git add .
git commit -m "merge: integrate sarah-dev"

# Now your branch has code from everyone
# Test everything together
git push origin teamlead-dev

# Create one big PR to main or several individual PRs
```

---

### **Keep Collaborator's Branch Updated Too**

If your collaborator's branch gets outdated, help them sync:

```bash
# As team lead, you can update their branch
git checkout mavis-dev              # Switch to their branch
git pull origin main                # Get latest main
git push origin mavis-dev           # Push updated branch

# Or tell them to do:
git checkout mavis-dev
git pull origin main
git push origin mavis-dev
```

---

### **Compare Branches Before Merging**

Before merging, see what's different:

```bash
# See differences between your branch and main
git diff main..teamlead-dev

# See differences between your branch and collaborator's
git diff teamlead-dev..origin/mavis-dev

# See which commits are different
git log main..teamlead-dev          # Commits in teamlead-dev not in main
git log teamlead-dev..main          # Commits in main not in teamlead-dev

# Visual comparison on GitHub
# Go to GitHub → Compare tab
# Select two branches: main...teamlead-dev
```

---

### **Handling Merge Conflicts in Detail**

When you `git merge origin/mavis-dev` and there are conflicts:

```bash
# 1. Git will tell you which files have conflicts
#    VS Code will show:
#    <<<<<<< HEAD (your changes)
#    your code here
#    =======
#    their code here
#    >>>>>>> origin/mavis-dev

# 2. For each conflict, you choose:
#    - Accept Current Change (keep yours)
#    - Accept Incoming Change (keep theirs)
#    - Accept Both Changes (keep both)
#    - Resolve Manually (edit the file)

# 3. After resolving all conflicts:
git add .
git commit -m "merge: resolve conflicts between teamlead-dev and mavis-dev"

# 4. Continue with your work
git push origin teamlead-dev
```

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

## 🎯 Quick Reference - Team Lead Multi-Branch Operations

### **Scenario 1: Pull from Collaborator + Your Changes**
```bash
# Your branch has your work
git checkout teamlead-dev

# Get their latest code into your branch
git fetch origin
git merge origin/mavis-dev

# Fix any conflicts if needed
# ... resolve conflicts ...
git add .
git commit -m "merge: integrate mavis-dev"

# Add your own changes on top
git add .
git commit -m "feat: your improvements"

# Push everything to your branch
git push origin teamlead-dev

# Merge to main when ready
git checkout main
git pull origin main
git merge teamlead-dev
git push origin main
```

### **Scenario 2: Test Multiple Collaborators' Code Together**
```bash
git checkout teamlead-dev
git pull origin main

# Pull from multiple team members
git merge origin/mavis-dev
# ... resolve conflicts ...
git add . && git commit -m "merge: mavis-dev"

git merge origin/john-dev
# ... resolve conflicts ...
git add . && git commit -m "merge: john-dev"

git merge origin/sarah-dev
# ... resolve conflicts ...
git add . && git commit -m "merge: sarah-dev"

# Test everything together
# npm start

# If everything works:
git push origin teamlead-dev

# Then merge to main
```

### **Scenario 3: Compare Branches Before Merging**
```bash
# See what's different
git diff main..teamlead-dev

# See specific commits
git log main..teamlead-dev

# Visual on GitHub
# Compare tab → main...teamlead-dev
```

### **Scenario 4: Help Team Member Sync with Main**
```bash
# If their branch is outdated:
git checkout mavis-dev
git pull origin main
git push origin mavis-dev

# Tell them to do the same:
# git checkout mavis-dev
# git pull origin main
# git push origin mavis-dev
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
