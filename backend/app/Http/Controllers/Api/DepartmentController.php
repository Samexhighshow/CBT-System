<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Services\RoleScopeService;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct(
        private readonly RoleScopeService $roleScopeService
    ) {
    }

    private function buildClassLevelVariants(array $levels): array
    {
        return collect($levels)
            ->flatMap(function ($level) {
                $raw = trim((string) $level);
                if ($raw === '') {
                    return [];
                }
                $compact = str_replace(' ', '', $raw);

                $normalizedUpper = strtoupper($compact);
                $families = [];
                if (str_starts_with($normalizedUpper, 'SS')) {
                    $families[] = 'SSS';
                }
                if (str_starts_with($normalizedUpper, 'JSS')) {
                    $families[] = 'JSS';
                }

                return [
                    $raw,
                    strtolower($raw),
                    strtoupper($raw),
                    $compact,
                    strtolower($compact),
                    strtoupper($compact),
                    ...$families,
                ];
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function isDepartmentLevelWithinScope(?\App\Models\User $user, string $departmentClassLevel): bool
    {
        if (!$this->roleScopeService->isScopedActor($user)) {
            return true;
        }

        if ($this->roleScopeService->canAccessSubjectClass($user, null, $departmentClassLevel, null)) {
            return true;
        }

        $variants = $this->buildClassLevelVariants($this->roleScopeService->scopedClassLevels($user));
        $target = strtoupper(str_replace(' ', '', trim($departmentClassLevel)));

        return in_array($target, array_map(fn ($v) => strtoupper(str_replace(' ', '', (string) $v)), $variants), true);
    }

    private function canManageDepartmentScope(?\App\Models\User $user, Department $department): bool
    {
        return $this->isDepartmentLevelWithinScope($user, (string) ($department->class_level ?? ''));
    }

    public function index(Request $request)
    {
        // Return basic departments without counting relations
        $query = Department::query();

        if ($this->roleScopeService->isScopedActor($request->user())) {
            $variants = $this->buildClassLevelVariants($this->roleScopeService->scopedClassLevels($request->user()));
            if (empty($variants)) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('class_level', $variants);
            }
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Pagination
        $perPage = $request->input('limit', 15);
        $departments = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'data' => $departments->items(),
            'current_page' => $departments->currentPage(),
            'last_page' => $departments->lastPage(),
            'per_page' => $departments->perPage(),
            'total' => $departments->total(),
            'next_page' => $departments->currentPage() < $departments->lastPage() ? $departments->currentPage() + 1 : null,
            'prev_page' => $departments->currentPage() > 1 ? $departments->currentPage() - 1 : null,
        ]);
    }

    public function show(Request $request, $id)
    {
        // Return department without loading relations to avoid errors
        $department = Department::findOrFail($id);
        if (!$this->canManageDepartmentScope($request->user(), $department)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }
        return response()->json($department);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
            'code' => 'required|string|max:20|unique:departments,code',
            'description' => 'nullable|string',
            'class_level' => 'required|string|max:255'
        ]);

        if (!$this->isDepartmentLevelWithinScope($request->user(), (string) $validated['class_level'])) {
            return response()->json(['message' => 'Forbidden: class level is outside your role scope.'], 403);
        }

        $department = Department::create($validated);

        return response()->json([
            'message' => 'Department created successfully',
            'department' => $department
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $department = Department::findOrFail($id);
        if (!$this->canManageDepartmentScope($request->user(), $department)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:departments,name,' . $id,
            'code' => 'sometimes|string|max:20|unique:departments,code,' . $id,
            'description' => 'nullable|string',
            'class_level' => 'sometimes|string|max:255'
        ]);

        if (array_key_exists('class_level', $validated)) {
            if (!$this->isDepartmentLevelWithinScope($request->user(), (string) $validated['class_level'])) {
                return response()->json(['message' => 'Forbidden: class level is outside your role scope.'], 403);
            }
        }

        $department->update($validated);

        return response()->json([
            'message' => 'Department updated successfully',
            'department' => $department
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $department = Department::findOrFail($id);
        if (!$this->canManageDepartmentScope($request->user(), $department)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }
        $department->delete();

        return response()->json([
            'message' => 'Department deleted successfully'
        ]);
    }

    /**
     * Bulk delete departments.
     */
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:departments,id',
        ]);

        if ($this->roleScopeService->isScopedActor($request->user())) {
            $departments = Department::whereIn('id', $validated['ids'])->get();
            foreach ($departments as $department) {
                if (!$this->canManageDepartmentScope($request->user(), $department)) {
                    return response()->json(['message' => 'Forbidden: one or more departments are outside your role scope.'], 403);
                }
            }
        }

        $deletedCount = Department::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'message' => 'Departments deleted successfully',
            'deleted_count' => $deletedCount
        ]);
    }

    /**
     * Bulk upload departments from CSV.
     * Expected CSV format: name,code,description,class_level,is_active
     */
    public function bulkUpload(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120'
        ]);

        $file = $validated['file'];
        $content = file_get_contents($file->getPathname());
        $lines = array_filter(explode("\n", trim($content)));

        if (count($lines) < 2) {
            return response()->json([
                'message' => 'CSV file must contain header and at least one data row',
                'inserted' => 0,
                'errors' => [],
                'error_count' => 0
            ], 422);
        }

        // Validate header
        $header = str_getcsv(trim($lines[0]));
        $expectedHeader = ['name', 'code', 'description', 'class_level', 'is_active'];
        
        if ($header !== $expectedHeader) {
            return response()->json([
                'message' => 'Invalid CSV header. Expected: name,code,description,class_level,is_active',
                'inserted' => 0,
                'errors' => ['Invalid CSV header format'],
                'error_count' => 1
            ], 422);
        }

        $inserted = 0;
        $errors = [];

        // Process each row
        foreach (array_slice($lines, 1) as $rowNum => $line) {
            $row = str_getcsv(trim($line));
            $lineNum = $rowNum + 2; // +2 because we skip header and start from line 2

            // Validate required fields
            if (count($row) < 5) {
                $errors[] = "Line {$lineNum}: Missing required fields";
                continue;
            }

            $name = trim($row[0]);
            $code = trim($row[1]);
            $description = trim($row[2]);
            $classLevel = trim($row[3]);
            $isActive = strtolower(trim($row[4])) === 'true' || trim($row[4]) === '1';

            if (!$this->isDepartmentLevelWithinScope($request->user(), (string) $classLevel)) {
                $errors[] = "Line {$lineNum}: class level '{$classLevel}' is outside your role scope";
                continue;
            }

            // Validate required fields are not empty
            if (empty($name) || empty($code) || empty($classLevel)) {
                $errors[] = "Line {$lineNum}: Name, code, and class_level are required";
                continue;
            }

            // Check for duplicates
            $existingName = Department::where('name', $name)->first();
            $existingCode = Department::where('code', $code)->first();

            if ($existingName) {
                $errors[] = "Line {$lineNum}: Department name '{$name}' already exists";
                continue;
            }

            if ($existingCode) {
                $errors[] = "Line {$lineNum}: Department code '{$code}' already exists";
                continue;
            }

            try {
                Department::create([
                    'name' => $name,
                    'code' => $code,
                    'description' => $description,
                    'class_level' => $classLevel,
                    'is_active' => $isActive
                ]);
                $inserted++;
            } catch (\Exception $e) {
                $errors[] = "Line {$lineNum}: {$e->getMessage()}";
            }
        }

        $statusCode = $inserted === 0 && count($errors) > 0 ? 422 : 200;

        return response()->json([
            'message' => $inserted > 0 ? "Successfully imported {$inserted} department(s)" : 'No departments were imported',
            'inserted' => $inserted,
            'errors' => $errors,
            'error_count' => count($errors)
        ], $statusCode);
    }
}
