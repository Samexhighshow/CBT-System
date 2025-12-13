<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClassController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = SchoolClass::query();

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        // Active status filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        } elseif (!$request->has('show_all')) {
            // By default, show only active classes unless show_all is requested
            $query->where('is_active', true);
        }

        // Pagination
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
        // Base validation
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
            'department_id' => 'nullable|integer|exists:departments,id',
        ]);

        // If class is SSS level, department is required
        if (strtoupper($validated['name']) !== null && str_contains(strtoupper($validated['name']), 'SSS')) {
            $request->validate([
                'department_id' => 'required|integer|exists:departments,id',
            ]);
            $validated['department_id'] = (int) $request->input('department_id');

            // Enforce uniqueness within department for SSS classes
            $exists = \App\Models\SchoolClass::where('name', $validated['name'])
                ->where('department_id', $validated['department_id'])
                ->exists();
            if ($exists) {
                return response()->json([
                    'message' => 'This SSS class already exists for the selected department',
                    'errors' => ['name' => ['Duplicate class within department']]
                ], 422);
            }
        } else {
            // Non-SSS classes are unique by name only
            $request->validate([
                'name' => 'unique:school_classes,name',
            ]);
        }

        $class = SchoolClass::create($validated);

        return response()->json([
            'message' => 'Class created successfully',
            'class' => $class
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $class = SchoolClass::with('students')
            ->withCount('students')
            ->findOrFail($id);

        return response()->json($class);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $class = SchoolClass::findOrFail($id);

        // Base validation
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
            'department_id' => 'nullable|integer|exists:departments,id',
        ]);

        // Determine target name and department after update
        $targetName = $validated['name'] ?? $class->name;
        $targetDept = array_key_exists('department_id', $validated) ? $validated['department_id'] : $class->department_id;

        // If SSS, require department and enforce uniqueness by (name, department_id)
        if (str_contains(strtoupper($targetName), 'SSS')) {
            if ($targetDept === null) {
                return response()->json([
                    'message' => 'Department is required for SSS classes',
                    'errors' => ['department_id' => ['Department is required for SSS classes']]
                ], 422);
            }

            $exists = \App\Models\SchoolClass::where('name', $targetName)
                ->where('department_id', $targetDept)
                ->where('id', '!=', $id)
                ->exists();
            if ($exists) {
                return response()->json([
                    'message' => 'This SSS class already exists for the selected department',
                    'errors' => ['name' => ['Duplicate class within department']]
                ], 422);
            }
        } else {
            // Non-SSS classes: unique by name only
            $request->validate([
                'name' => [Rule::unique('school_classes', 'name')->ignore($id)],
            ]);
        }

        $class->update($validated);

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $class = SchoolClass::withCount('students')->findOrFail($id);

        // Check if class has students
        if ($class->students_count > 0) {
            return response()->json([
                'message' => 'Cannot delete class with enrolled students',
                'students_count' => $class->students_count
            ], 422);
        }

        $class->delete();

        return response()->json([
            'message' => 'Class deleted successfully'
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

        $classes = SchoolClass::withCount('students')
            ->whereIn('id', $validated['ids'])
            ->get();

        // Check if any class has students
        $classesWithStudents = $classes->filter(fn($c) => $c->students_count > 0);
        if ($classesWithStudents->isNotEmpty()) {
            return response()->json([
                'message' => 'Cannot delete classes with enrolled students',
                'classes_with_students' => $classesWithStudents->map(fn($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'students_count' => $c->students_count
                ])
            ], 422);
        }

        $deletedCount = SchoolClass::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'message' => 'Classes deleted successfully',
            'deleted_count' => $deletedCount
        ]);
    }

    /**
     * Bulk upload classes from CSV
     * Expected columns: name,description,capacity,is_active
     */
    public function bulkUpload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120'
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $content = file_get_contents($path);
        $lines = explode("\n", trim($content));

        if (count($lines) < 2) {
            return response()->json([
                'message' => 'CSV file is empty or invalid',
                'errors' => ['file' => ['CSV must contain header and at least one row']]
            ], 422);
        }

        $header = str_getcsv(array_shift($lines));
        $expectedHeaders = ['name', 'description', 'capacity', 'is_active'];
        
        if ($header !== $expectedHeaders) {
            return response()->json([
                'message' => 'Invalid CSV header format',
                'expected' => $expectedHeaders,
                'provided' => $header,
                'errors' => ['file' => ['CSV header does not match expected format']]
            ], 422);
        }

        $inserted = 0;
        $errors = [];
        $rowNum = 2;

        foreach ($lines as $line) {
            if (empty(trim($line))) continue;

            $data = str_getcsv($line);
            
            if (count($data) !== count($expectedHeaders)) {
                $errors[] = "Row {$rowNum}: Invalid number of columns";
                $rowNum++;
                continue;
            }

            $row = array_combine($expectedHeaders, $data);
            
            try {
                // Validate required fields
                if (empty($row['name'])) {
                    $errors[] = "Row {$rowNum}: Class name is required";
                    $rowNum++;
                    continue;
                }

                // Check for duplicate
                if (SchoolClass::where('name', $row['name'])->exists()) {
                    $errors[] = "Row {$rowNum}: Class '{$row['name']}' already exists";
                    $rowNum++;
                    continue;
                }

                SchoolClass::create([
                    'name' => $row['name'],
                    'description' => $row['description'] ?? null,
                    'capacity' => (int)($row['capacity'] ?? 30),
                    'is_active' => filter_var($row['is_active'] ?? '1', FILTER_VALIDATE_BOOLEAN)
                ]);

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
            'error_count' => count($errors)
        ], count($errors) > 0 && $inserted === 0 ? 422 : 200);
    }
}
