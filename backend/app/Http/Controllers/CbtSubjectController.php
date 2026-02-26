<?php

namespace App\Http\Controllers;

use App\Models\CbtSubject;
use App\Models\RoleScope;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Services\RoleScopeService;
use Illuminate\Http\Request;

class CbtSubjectController extends Controller
{
    public function __construct(private readonly RoleScopeService $roleScopeService)
    {
    }

    // List subjects (teacher sees only assigned, admin sees all)
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Check for admin roles (case-insensitive, handle spaces and hyphens)
        $isAdmin = $user->hasRole(['Admin', 'Main Admin', 'admin', 'main-admin']);
        
        if ($isAdmin) {
            // Admin sees all subjects
            $subjects = CbtSubject::with('owner')->get();
        } else {
            $subjectIds = $this->roleScopeService->scopedSubjectIds($user);
            $classIds = $this->roleScopeService->scopedClassIds($user);
            $classNames = SchoolClass::query()->whereIn('id', $classIds)->pluck('name')->map(fn ($x) => strtolower(trim((string) $x)))->all();

            if (empty($subjectIds) && empty($classIds)) {
                $subjects = collect();
            } else {
                $subjectNames = Subject::query()->whereIn('id', $subjectIds)->pluck('name')->map(fn ($x) => strtolower(trim((string) $x)))->all();
                $subjects = CbtSubject::query()
                    ->where(function ($query) use ($subjectNames, $classNames) {
                        if (!empty($subjectNames)) {
                            foreach ($subjectNames as $name) {
                                $query->orWhereRaw('LOWER(subject_name) = ?', [$name]);
                            }
                        }
                        if (!empty($classNames)) {
                            foreach ($classNames as $className) {
                                $query->orWhereRaw('LOWER(class_level) = ?', [$className]);
                            }
                        }
                    })
                    ->with('owner')
                    ->get();
            }
        }

        // Keep admin view seeded even when CBT table is empty.
        if ($subjects->isEmpty() && $isAdmin) {
            $this->hydrateFromAcademicSubjects((int) $user->id);
            $subjects = CbtSubject::with('owner')->get();
        }

        return response()->json(['status' => 'ok', 'subjects' => $subjects]);
    }

    // Create subject (admin/teacher)
    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject_name' => 'required|string',
            'class_level' => 'required|string',
            'shuffle_questions' => 'boolean',
            'questions_required' => 'required|integer|min:1',
            'total_marks' => 'required|integer|min:1',
            'duration_minutes' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ]);

        $subject = CbtSubject::create([
            ...$validated,
            'owner_id' => $request->user()->id,
        ]);

        return response()->json(['status' => 'ok', 'subject' => $subject]);
    }

    // Assign teacher to subject/class
    public function assignTeacher(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => 'required|exists:users,id',
            'cbt_subject_id' => 'required|exists:cbt_subjects,id',
            'class_category' => 'required|in:junior,senior',
        ]);

        $cbtSubject = CbtSubject::findOrFail($validated['cbt_subject_id']);
        $subject = Subject::query()
            ->whereRaw('LOWER(name) = ?', [strtolower(trim((string) $cbtSubject->subject_name))])
            ->first();
        $classPrefix = $validated['class_category'] === 'senior' ? 'SSS' : 'JSS';
        $classIds = SchoolClass::query()->where('name', 'like', $classPrefix . '%')->pluck('id');

        foreach ($classIds as $classId) {
            RoleScope::updateOrCreate(
                [
                    'user_id' => (int) $validated['teacher_id'],
                    'role_name' => 'teacher',
                    'subject_id' => $subject?->id,
                    'class_id' => (int) $classId,
                    'academic_session' => null,
                    'term' => null,
                ],
                [
                    'is_active' => true,
                    'status' => 'approved',
                    'requested_by' => $request->user()?->id,
                    'approved_by' => $request->user()?->id,
                    'approved_at' => now(),
                    'rejected_reason' => null,
                ]
            );
        }

        return response()->json(['status' => 'ok', 'message' => 'Teacher scope assigned']);
    }

    // Get teacher's assigned subjects
    public function teacherSubjects(Request $request, int $teacherId)
    {
        $assignments = RoleScope::query()
            ->where('user_id', $teacherId)
            ->where('role_name', 'teacher')
            ->with(['subject:id,name,code', 'schoolClass:id,name'])
            ->get();

        return response()->json(['status' => 'ok', 'assignments' => $assignments]);
    }

    // Teacher self-assigns subjects after role assignment
    public function selfAssignSubjects(Request $request)
    {
        $validated = $request->validate([
            'subject_ids' => 'required|array',
            'subject_ids.*' => 'required|exists:cbt_subjects,id',
        ]);

        $teacherId = $request->user()->id;

        foreach ($validated['subject_ids'] as $subjectId) {
            $subject = CbtSubject::find($subjectId);
            if (!$subject) {
                continue;
            }

            $mappedSubject = Subject::query()
                ->whereRaw('LOWER(name) = ?', [strtolower(trim((string) $subject->subject_name))])
                ->first();
            $class = SchoolClass::query()
                ->whereRaw('LOWER(name) = ?', [strtolower(trim((string) $subject->class_level))])
                ->first();

            RoleScope::updateOrCreate(
                [
                    'user_id' => $teacherId,
                    'role_name' => 'teacher',
                    'subject_id' => $mappedSubject?->id,
                    'class_id' => $class?->id,
                    'academic_session' => null,
                    'term' => null,
                ],
                [
                    'is_active' => false,
                    'status' => 'pending',
                    'requested_by' => $teacherId,
                    'approved_by' => null,
                    'approved_at' => null,
                    'rejected_reason' => null,
                ]
            );
        }

        return response()->json(['status' => 'ok', 'message' => 'Scope requests submitted for approval']);
    }

    private function hydrateFromAcademicSubjects(int $ownerId): void
    {
        $academicSubjects = Subject::query()
            ->with('schoolClass:id,name')
            ->where(function ($query) {
                $query->whereNull('is_active')->orWhere('is_active', true);
            })
            ->get(['id', 'name', 'class_id', 'class_level']);

        foreach ($academicSubjects as $subject) {
            $classLevel = trim((string) ($subject->class_level ?: ($subject->schoolClass?->name ?? '')));
            if ($classLevel === '') {
                continue;
            }

            CbtSubject::query()->firstOrCreate(
                [
                    'subject_name' => (string) $subject->name,
                    'class_level' => $classLevel,
                ],
                [
                    'owner_id' => $ownerId,
                    'shuffle_questions' => false,
                    'questions_required' => 30,
                    'total_marks' => 70,
                    'duration_minutes' => 60,
                    'is_active' => true,
                ]
            );
        }
    }
}
