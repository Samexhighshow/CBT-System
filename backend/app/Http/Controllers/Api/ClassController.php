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
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Department filter
        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Active status filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        } else {
            // By default, show only active classes
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
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:school_classes,code',
            'department_id' => 'nullable|exists:departments,id',
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
        ]);

        // Check if this is an SSS class and validate department requirement
        $isSSS = str_contains(strtoupper($validated['name']), 'SSS');
        if ($isSSS && !$request->department_id) {
            return response()->json([
                'message' => 'Department is required for SSS classes',
                'errors' => ['department_id' => ['Department is required for SSS classes']]
            ], 422);
        }

        $class = SchoolClass::create($validated);

        return response()->json([
            'message' => 'Class created successfully',
            'class' => $class->load('department')
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $class = SchoolClass::with(['department', 'students'])
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

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('school_classes')->ignore($class->id)],
            'department_id' => 'sometimes|exists:departments,id',
            'description' => 'nullable|string',
            'capacity' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
        ]);

        $class->update($validated);

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class->load('department')
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
}
