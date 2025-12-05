<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hall;
use App\Models\HallTeacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HallController extends Controller
{
    /**
     * Get all halls
     */
    public function index(Request $request)
    {
        $query = Hall::query();

        if ($request->has('active_only')) {
            $query->active();
        }

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $halls = $query->withCount('allocations')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'halls' => $halls,
        ]);
    }

    /**
     * Get single hall with details
     */
    public function show($id)
    {
        $hall = Hall::with(['hallTeachers.teacher', 'hallTeachers.exam'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'hall' => $hall,
        ]);
    }

    /**
     * Create new hall
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:halls,name',
            'rows' => 'required|integer|min:1|max:100',
            'columns' => 'required|integer|min:1|max:100',
            'teachers_needed' => 'nullable|integer|min:1|max:10',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $hall = Hall::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Hall created successfully',
            'hall' => $hall,
        ], 201);
    }

    /**
     * Update hall
     */
    public function update(Request $request, $id)
    {
        $hall = Hall::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:halls,name,' . $id,
            'rows' => 'sometimes|integer|min:1|max:100',
            'columns' => 'sometimes|integer|min:1|max:100',
            'teachers_needed' => 'sometimes|integer|min:1|max:10',
            'notes' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $hall->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Hall updated successfully',
            'hall' => $hall->fresh(),
        ]);
    }

    /**
     * Delete hall
     */
    public function destroy($id)
    {
        $hall = Hall::findOrFail($id);

        // Check if hall has allocations
        if ($hall->allocations()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete hall with existing allocations',
            ], 422);
        }

        $hall->delete();

        return response()->json([
            'success' => true,
            'message' => 'Hall deleted successfully',
        ]);
    }

    /**
     * Assign teachers to hall for specific exam
     */
    public function assignTeachers(Request $request, $id)
    {
        $hall = Hall::findOrFail($id);

        $validated = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'teachers' => 'required|array|min:1',
            'teachers.*.teacher_id' => 'required|exists:users,id',
            'teachers.*.role' => 'required|in:supervisor,chief_supervisor',
        ]);

        DB::beginTransaction();

        try {
            // Remove existing assignments for this exam
            HallTeacher::where('hall_id', $id)
                ->where('exam_id', $validated['exam_id'])
                ->delete();

            // Create new assignments
            foreach ($validated['teachers'] as $teacher) {
                HallTeacher::create([
                    'hall_id' => $id,
                    'exam_id' => $validated['exam_id'],
                    'teacher_id' => $teacher['teacher_id'],
                    'role' => $teacher['role'],
                    'assigned_at' => now(),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Teachers assigned successfully',
                'assignments' => HallTeacher::where('hall_id', $id)
                    ->where('exam_id', $validated['exam_id'])
                    ->with('teacher')
                    ->get(),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Get hall grid layout for specific allocation
     */
    public function getGridLayout($id, Request $request)
    {
        $hall = Hall::findOrFail($id);

        $allocationRunId = $request->get('allocation_run_id');

        $grid = $hall->getGridLayout($allocationRunId);

        return response()->json([
            'success' => true,
            'hall' => $hall,
            'grid' => $grid,
        ]);
    }

    /**
     * Get capacity statistics
     */
    public function stats()
    {
        $stats = [
            'total_halls' => Hall::count(),
            'active_halls' => Hall::active()->count(),
            'total_capacity' => Hall::active()->sum(DB::raw('rows * columns')),
            'average_capacity' => Hall::active()->avg(DB::raw('rows * columns')),
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
        ]);
    }
}
