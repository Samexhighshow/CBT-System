<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Services\RoleScopeService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClassController extends Controller
{
    public function __construct(
        private readonly RoleScopeService $roleScopeService
    ) {
    }

    /**
     * Public-safe class list (active classes only).
     */
    public function publicIndex(Request $request)
    {
        $query = SchoolClass::query()
            ->select(['id', 'name', 'department_id'])
            ->where('is_active', true);

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where('name', 'like', "%{$search}%");
        }

        $classes = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'data' => $classes,
            'total' => $classes->count(),
        ]);
    }

    /**
     * Public-safe class detail (active classes only).
     */
    public function publicShow(string $id)
    {
        $class = SchoolClass::query()
            ->select(['id', 'name', 'department_id', 'is_active'])
            ->where('is_active', true)
            ->findOrFail($id);

        return response()->json($class);
    }

    /**
     * Display scoped class list for staff users.
     */
    public function index(Request $request)
    {
        $query = SchoolClass::query();
        $this->roleScopeService->applyClassScope($query, $request->user());

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        } elseif (!$request->has('show_all')) {
            $query->where('is_active', true);
        }

        $perPage = $request->input('limit', 15);
        $classes = $query->orderBy('name', 'asc')->paginate($perPage);

        return response()->json([
            'data' => $classes->items(),
            'current_page' => $classes->currentPage(),
            'last_page' => $classes->lastPage(),
            'per_page' => $classes->perPage(),
            'total' => $classes->total(),
            'next_page' => $classes->currentPage() < $classes->lastPage() ? $classes->currentPage() + 1 : null,
            'prev_page' => $classes->currentPage() > 1 ? $classes->currentPage() - 1 : null,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
            'department_id' => 'nullable|integer|exists:departments,id',
        ]);

        if (str_contains(strtoupper((string) $validated['name']), 'SSS')) {
            $request->validate([
                'department_id' => 'required|integer|exists:departments,id',
            ]);
            $validated['department_id'] = (int) $request->input('department_id');

            $exists = SchoolClass::where('name', $validated['name'])
                ->where('department_id', $validated['department_id'])
                ->exists();
            if ($exists) {
                return response()->json([
                    'message' => 'This SSS class already exists for the selected department',
                    'errors' => ['name' => ['Duplicate class within department']],
                ], 422);
            }
        } else {
            $request->validate([
                'name' => 'unique:school_classes,name',
            ]);
        }

        $class = SchoolClass::create($validated);

        if (!$this->roleScopeService->canManageClass($request->user(), $class)) {
            $class->delete();
            return response()->json(['message' => 'Forbidden: class not in your role scope.'], 403);
        }

        return response()->json([
            'message' => 'Class created successfully',
            'class' => $class,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $class = SchoolClass::with('students', 'subjects')
            ->withCount('students')
            ->findOrFail($id);

        if (!$this->roleScopeService->canManageClass(request()->user(), $class)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        return response()->json($class);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $class = SchoolClass::findOrFail($id);
        if (!$this->roleScopeService->canManageClass($request->user(), $class)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
            'department_id' => 'nullable|integer|exists:departments,id',
        ]);

        $targetName = $validated['name'] ?? $class->name;
        $targetDept = array_key_exists('department_id', $validated) ? $validated['department_id'] : $class->department_id;

        if (str_contains(strtoupper((string) $targetName), 'SSS')) {
            if ($targetDept === null) {
                return response()->json([
                    'message' => 'Department is required for SSS classes',
                    'errors' => ['department_id' => ['Department is required for SSS classes']],
                ], 422);
            }

            $exists = SchoolClass::where('name', $targetName)
                ->where('department_id', $targetDept)
                ->where('id', '!=', $id)
                ->exists();
            if ($exists) {
                return response()->json([
                    'message' => 'This SSS class already exists for the selected department',
                    'errors' => ['name' => ['Duplicate class within department']],
                ], 422);
            }
        } else {
            $request->validate([
                'name' => [Rule::unique('school_classes', 'name')->ignore($id)],
            ]);
        }

        $class->update($validated);

        if (!$this->roleScopeService->canManageClass($request->user(), $class->fresh())) {
            return response()->json(['message' => 'Forbidden: class not in your role scope.'], 403);
        }

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $class = SchoolClass::withCount('students')->findOrFail($id);
        if (!$this->roleScopeService->canManageClass(request()->user(), $class)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        if ($class->students_count > 0) {
            return response()->json([
                'message' => 'Cannot delete class with enrolled students',
                'students_count' => $class->students_count,
            ], 422);
        }

        $class->delete();

        return response()->json([
            'message' => 'Class deleted successfully',
        ]);
    }

    /**
     * Bulk delete classes.
     */
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:school_classes,id',
        ]);

        $classes = SchoolClass::query()
            ->withCount('students')
            ->whereIn('id', $validated['ids'])
            ->get();

        if ($this->roleScopeService->isScopedActor($request->user())) {
            $blocked = $classes->filter(
                fn (SchoolClass $class) => !$this->roleScopeService->canManageClass($request->user(), $class)
            );

            if ($blocked->isNotEmpty()) {
                return response()->json([
                    'message' => 'Forbidden: one or more classes are outside your role scope.',
                ], 403);
            }
        }

        $classesWithStudents = $classes->filter(fn ($c) => $c->students_count > 0);
        if ($classesWithStudents->isNotEmpty()) {
            return response()->json([
                'message' => 'Cannot delete classes with enrolled students',
                'classes_with_students' => $classesWithStudents->map(fn ($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'students_count' => $c->students_count,
                ]),
            ], 422);
        }

        $deletedCount = SchoolClass::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'message' => 'Classes deleted successfully',
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Bulk upload classes from CSV
     * Expected columns: name,description,capacity,is_active
     */
    public function bulkUpload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $content = file_get_contents($path);
        $lines = explode("\n", trim($content));

        if (count($lines) < 2) {
            return response()->json([
                'message' => 'CSV file is empty or invalid',
                'errors' => ['file' => ['CSV must contain header and at least one row']],
            ], 422);
        }

        $header = str_getcsv(array_shift($lines));
        $expectedHeaders = ['name', 'description', 'capacity', 'is_active'];

        if ($header !== $expectedHeaders) {
            return response()->json([
                'message' => 'Invalid CSV header format',
                'expected' => $expectedHeaders,
                'provided' => $header,
                'errors' => ['file' => ['CSV header does not match expected format']],
            ], 422);
        }

        $inserted = 0;
        $errors = [];
        $rowNum = 2;

        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            $data = str_getcsv($line);

            if (count($data) !== count($expectedHeaders)) {
                $errors[] = "Row {$rowNum}: Invalid number of columns";
                $rowNum++;
                continue;
            }

            $row = array_combine($expectedHeaders, $data);

            try {
                if (empty($row['name'])) {
                    $errors[] = "Row {$rowNum}: Class name is required";
                    $rowNum++;
                    continue;
                }

                if (SchoolClass::where('name', $row['name'])->exists()) {
                    $errors[] = "Row {$rowNum}: Class '{$row['name']}' already exists";
                    $rowNum++;
                    continue;
                }

                $class = SchoolClass::create([
                    'name' => $row['name'],
                    'description' => $row['description'] ?? null,
                    'capacity' => (int) ($row['capacity'] ?? 30),
                    'is_active' => filter_var($row['is_active'] ?? '1', FILTER_VALIDATE_BOOLEAN),
                ]);

                if (!$this->roleScopeService->canManageClass($request->user(), $class)) {
                    $class->delete();
                    $errors[] = "Row {$rowNum}: Class outside your role scope";
                    $rowNum++;
                    continue;
                }

                $inserted++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: {$e->getMessage()}";
            }

            $rowNum++;
        }

        return response()->json([
            'message' => "Bulk upload completed. {$inserted} classes imported.",
            'inserted' => $inserted,
            'errors' => $errors,
            'error_count' => count($errors),
        ], count($errors) > 0 && $inserted === 0 ? 422 : 200);
    }
}
