<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        // Return basic departments without counting relations
        $query = Department::query();

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

    public function show($id)
    {
        // Return department without loading relations to avoid errors
        $department = Department::findOrFail($id);
        return response()->json($department);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
            'code' => 'required|string|max:20|unique:departments,code',
            'description' => 'nullable|string',
        ]);

        $department = Department::create($validated);

        return response()->json([
            'message' => 'Department created successfully',
            'department' => $department
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:departments,name,' . $id,
            'code' => 'sometimes|string|max:20|unique:departments,code,' . $id,
            'description' => 'nullable|string',
        ]);

        $department->update($validated);

        return response()->json([
            'message' => 'Department updated successfully',
            'department' => $department
        ]);
    }

    public function destroy($id)
    {
        $department = Department::findOrFail($id);
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

        $deletedCount = Department::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'message' => 'Departments deleted successfully',
            'deleted_count' => $deletedCount
        ]);
    }
}
