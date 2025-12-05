<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateAllocation;
use App\Models\Allocation;
use App\Models\AllocationRun;
use App\Models\Exam;
use App\Models\Hall;
use App\Models\SeatConflict;
use App\Services\AllocationEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\AllocationExport;

class AllocationController extends Controller
{
    /**
     * Get all allocation runs for an exam
     */
    public function index(Request $request, $examId)
    {
        $runs = AllocationRun::where('exam_id', $examId)
            ->with('creator')
            ->withCount('allocations')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'runs' => $runs,
        ]);
    }

    /**
     * Get allocation run details
     */
    public function show($id)
    {
        $run = AllocationRun::with([
            'exam',
            'creator',
            'allocations.student',
            'allocations.hall',
        ])->findOrFail($id);

        $conflicts = SeatConflict::whereHas('allocation', function ($query) use ($id) {
            $query->where('allocation_run_id', $id);
        })->with(['allocation.student', 'conflictingAllocation.student'])->get();

        return response()->json([
            'success' => true,
            'run' => $run,
            'conflicts' => $conflicts,
        ]);
    }

    /**
     * Generate allocation (synchronous for small exams, async for large)
     */
    public function generate(Request $request)
    {
        $validated = $request->validate([
            'exam_id' => 'required|exists:exams,id',
            'mode' => 'nullable|in:auto,manual',
            'seat_numbering' => 'nullable|in:row_major,column_major',
            'adjacency_strictness' => 'nullable|in:hard,soft',
            'notes' => 'nullable|string',
            'async' => 'nullable|boolean',
        ]);

        $exam = Exam::with('students')->findOrFail($validated['exam_id']);

        // Validation: check if halls available
        if (Hall::active()->count() === 0) {
            return response()->json([
                'success' => false,
                'message' => 'No active halls available. Please configure halls first.',
            ], 422);
        }

        // Create allocation run
        $run = AllocationRun::create([
            'exam_id' => $validated['exam_id'],
            'created_by' => Auth::id(),
            'shuffle_seed' => Str::random(32),
            'mode' => $validated['mode'] ?? 'auto',
            'seat_numbering' => $validated['seat_numbering'] ?? 'row_major',
            'adjacency_strictness' => $validated['adjacency_strictness'] ?? 'hard',
            'notes' => $validated['notes'] ?? null,
        ]);

        // Determine if async needed (> 500 students)
        $studentCount = $exam->students()->count();
        $useAsync = $validated['async'] ?? ($studentCount > 500);

        if ($useAsync) {
            // Dispatch background job
            GenerateAllocation::dispatch($run->id);

            return response()->json([
                'success' => true,
                'message' => 'Allocation job queued. This may take a few minutes.',
                'allocation_run_id' => $run->id,
                'is_async' => true,
            ], 202);
        }

        // Synchronous execution
        try {
            $engine = new AllocationEngine(
                $exam,
                $run,
                $run->mode,
                $run->seat_numbering,
                $run->adjacency_strictness
            );

            $result = $engine->execute();

            return response()->json([
                'success' => true,
                'message' => 'Allocation completed successfully',
                'result' => $result,
                'allocation_run_id' => $run->id,
                'is_async' => false,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Regenerate allocation (creates new run)
     */
    public function regenerate(Request $request, $id)
    {
        $oldRun = AllocationRun::findOrFail($id);

        // Create new run with same settings but new seed
        $newRun = AllocationRun::create([
            'exam_id' => $oldRun->exam_id,
            'created_by' => Auth::id(),
            'shuffle_seed' => Str::random(32),
            'mode' => $oldRun->mode,
            'seat_numbering' => $oldRun->seat_numbering,
            'adjacency_strictness' => $oldRun->adjacency_strictness,
            'notes' => 'Regenerated from run #' . $oldRun->id,
        ]);

        $exam = Exam::findOrFail($oldRun->exam_id);

        try {
            $engine = new AllocationEngine(
                $exam,
                $newRun,
                $newRun->mode,
                $newRun->seat_numbering,
                $newRun->adjacency_strictness
            );

            $result = $engine->execute();

            return response()->json([
                'success' => true,
                'message' => 'Allocation regenerated successfully',
                'result' => $result,
                'allocation_run_id' => $newRun->id,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get allocation for specific student
     */
    public function getStudentAllocation($examId, $studentId)
    {
        $latestRun = AllocationRun::where('exam_id', $examId)
            ->whereNotNull('completed_at')
            ->latest('created_at')
            ->first();

        if (!$latestRun) {
            return response()->json([
                'success' => false,
                'message' => 'No allocation found for this exam',
            ], 404);
        }

        $allocation = Allocation::where('allocation_run_id', $latestRun->id)
            ->where('student_id', $studentId)
            ->with(['hall', 'hall.hallTeachers.teacher'])
            ->first();

        if (!$allocation) {
            return response()->json([
                'success' => false,
                'message' => 'Student not allocated in this exam',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'allocation' => $allocation,
        ]);
    }

    /**
     * Manual edit: reassign student to different seat
     */
    public function reassignStudent(Request $request)
    {
        $validated = $request->validate([
            'allocation_id' => 'required|exists:allocations,id',
            'new_hall_id' => 'required|exists:halls,id',
            'new_row' => 'required|integer|min:1',
            'new_column' => 'required|integer|min:1',
        ]);

        $allocation = Allocation::findOrFail($validated['allocation_id']);
        $hall = Hall::findOrFail($validated['new_hall_id']);

        // Validate position exists
        if ($validated['new_row'] > $hall->rows || $validated['new_column'] > $hall->columns) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid seat position for selected hall',
            ], 422);
        }

        // Check if seat already occupied
        $occupied = Allocation::where('allocation_run_id', $allocation->allocation_run_id)
            ->where('hall_id', $validated['new_hall_id'])
            ->where('row', $validated['new_row'])
            ->where('column', $validated['new_column'])
            ->where('id', '!=', $allocation->id)
            ->exists();

        if ($occupied) {
            return response()->json([
                'success' => false,
                'message' => 'Seat already occupied',
            ], 422);
        }

        // Update allocation
        $allocation->update([
            'hall_id' => $validated['new_hall_id'],
            'row' => $validated['new_row'],
            'column' => $validated['new_column'],
            'seat_number' => $hall->computeSeatNumber(
                $validated['new_row'],
                $validated['new_column'],
                $allocation->allocationRun->seat_numbering
            ),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Student reassigned successfully',
            'allocation' => $allocation->fresh(),
        ]);
    }

    /**
     * Export allocation to PDF
     */
    public function exportPDF($runId)
    {
        $run = AllocationRun::with([
            'exam',
            'allocations.student',
            'allocations.hall',
        ])->findOrFail($runId);

        // Group by hall
        $hallGroups = $run->allocations->groupBy('hall_id');

        $pdf = Pdf::loadView('exports.allocation-pdf', [
            'run' => $run,
            'hallGroups' => $hallGroups,
        ]);

        return $pdf->download('allocation-' . $run->exam->title . '.pdf');
    }

    /**
     * Export allocation to Excel
     */
    public function exportExcel($runId)
    {
        $run = AllocationRun::findOrFail($runId);

        return Excel::download(
            new AllocationExport($runId),
            'allocation-' . $run->exam->title . '.xlsx'
        );
    }

    /**
     * Get conflicts report
     */
    public function getConflicts($runId)
    {
        $conflicts = SeatConflict::whereHas('allocation', function ($query) use ($runId) {
            $query->where('allocation_run_id', $runId);
        })
        ->with([
            'allocation.student',
            'allocation.hall',
            'conflictingAllocation.student',
        ])
        ->get();

        return response()->json([
            'success' => true,
            'conflicts' => $conflicts,
            'total' => $conflicts->count(),
            'unresolved' => $conflicts->where('resolved', false)->count(),
        ]);
    }

    /**
     * Check generation status (for async jobs)
     */
    public function checkStatus($runId)
    {
        $run = AllocationRun::findOrFail($runId);

        return response()->json([
            'success' => true,
            'status' => $run->isCompleted() ? 'completed' : 'pending',
            'completed_at' => $run->completed_at,
            'metadata' => $run->metadata,
        ]);
    }
}
