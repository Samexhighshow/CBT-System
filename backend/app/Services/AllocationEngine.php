<?php

namespace App\Services;

use App\Models\Allocation;
use App\Models\AllocationRun;
use App\Models\Exam;
use App\Models\Hall;
use App\Models\SeatConflict;
use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AllocationEngine
{
    protected $exam;
    protected $allocationRun;
    protected $halls;
    protected $students;
    protected $seed;
    protected $mode;
    protected $seatNumbering;
    protected $adjacencyStrictness;

    public function __construct(
        Exam $exam,
        AllocationRun $allocationRun,
        $mode = 'auto',
        $seatNumbering = 'row_major',
        $adjacencyStrictness = 'hard'
    ) {
        $this->exam = $exam;
        $this->allocationRun = $allocationRun;
        $this->mode = $mode;
        $this->seatNumbering = $seatNumbering;
        $this->adjacencyStrictness = $adjacencyStrictness;
        $this->seed = $allocationRun->shuffle_seed;
    }

    /**
     * Main allocation execution method
     */
    public function execute()
    {
        DB::beginTransaction();

        try {
            // Step 1: Fetch and validate resources
            $this->loadHalls();
            $this->loadStudents();
            $this->validateCapacity();

            // Step 2: Group students by class
            $studentGroups = $this->groupStudentsByClass();

            // Step 3: Shuffle groups for randomization
            $this->shuffleGroups($studentGroups);

            // Step 4: Generate seat order for each hall (checkerboard pattern)
            $hallSeatOrders = $this->generateHallSeatOrders();

            // Step 5: Allocate students using round-robin across classes
            $allocations = $this->allocateStudentsRoundRobin($studentGroups, $hallSeatOrders);

            // Step 6: Detect conflicts
            $conflicts = $this->detectConflicts($allocations);

            // Step 7: Attempt conflict resolution if strict mode
            if ($this->adjacencyStrictness === 'hard' && count($conflicts) > 0) {
                $this->resolveConflicts($allocations, $conflicts);
            }

            // Step 8: Save allocations and conflicts
            $this->saveAllocations($allocations);
            $this->saveConflicts($conflicts);

            // Step 9: Update metadata
            $this->updateMetadata($allocations, $conflicts);

            // Mark run as completed
            $this->allocationRun->markCompleted();

            DB::commit();

            return [
                'success' => true,
                'allocations_count' => count($allocations),
                'conflicts_count' => count($conflicts),
                'halls_used' => count($this->halls),
                'allocation_run_id' => $this->allocationRun->id,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Allocation failed: ' . $e->getMessage(), [
                'exam_id' => $this->exam->id,
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Load active halls
     */
    protected function loadHalls()
    {
        $this->halls = Hall::active()->orderBy('capacity', 'desc')->get();

        if ($this->halls->isEmpty()) {
            throw new \Exception('No active halls available for allocation');
        }
    }

    /**
     * Load students registered for this exam
     */
    protected function loadStudents()
    {
        // Adjust this query based on your student-exam relationship
        $this->students = Student::whereHas('exams', function ($query) {
            $query->where('exams.id', $this->exam->id);
        })->with('class')->get();

        if ($this->students->isEmpty()) {
            throw new \Exception('No students registered for this exam');
        }
    }

    /**
     * Validate total capacity vs student count
     */
    protected function validateCapacity()
    {
        $totalCapacity = $this->halls->sum('capacity');
        $studentCount = $this->students->count();

        if ($totalCapacity < $studentCount) {
            throw new \Exception(
                "Insufficient capacity: {$studentCount} students need seats but only {$totalCapacity} available. " .
                "Add more halls or increase hall capacity."
            );
        }
    }

    /**
     * Group students by class level
     */
    protected function groupStudentsByClass()
    {
        $groups = [];

        foreach ($this->students as $student) {
            $classLevel = $student->class_level ?? $student->class->name ?? 'unassigned';
            
            if (!isset($groups[$classLevel])) {
                $groups[$classLevel] = [];
            }
            
            $groups[$classLevel][] = $student;
        }

        return $groups;
    }

    /**
     * Shuffle student groups using seeded randomization
     */
    protected function shuffleGroups(&$groups)
    {
        mt_srand(crc32($this->seed));

        foreach ($groups as &$group) {
            shuffle($group);
        }

        mt_srand(); // Reset seed
    }

    /**
     * Generate checkerboard seat order for each hall
     * Fills alternating seats first to maximize separation
     */
    protected function generateHallSeatOrders()
    {
        $seatOrders = [];

        foreach ($this->halls as $hall) {
            $primary = []; // (r+c) % 2 == 0
            $secondary = []; // (r+c) % 2 == 1

            for ($r = 1; $r <= $hall->rows; $r++) {
                for ($c = 1; $c <= $hall->columns; $c++) {
                    $seat = [
                        'row' => $r,
                        'column' => $c,
                        'seat_number' => $hall->computeSeatNumber($r, $c, $this->seatNumbering),
                    ];

                    if (($r + $c) % 2 == 0) {
                        $primary[] = $seat;
                    } else {
                        $secondary[] = $seat;
                    }
                }
            }

            // Combine: fill checkerboard pattern first, then remaining
            $seatOrders[$hall->id] = array_merge($primary, $secondary);
        }

        return $seatOrders;
    }

    /**
     * Allocate students using round-robin across class groups
     */
    protected function allocateStudentsRoundRobin($studentGroups, $hallSeatOrders)
    {
        $allocations = [];
        $hallIndex = 0;
        $currentHall = $this->halls[$hallIndex];
        $currentSeatIndex = 0;
        $currentSeatOrder = $hallSeatOrders[$currentHall->id];

        $groupKeys = array_keys($studentGroups);
        $groupIndexes = array_fill_keys($groupKeys, 0);

        $totalPlaced = 0;
        $totalStudents = $this->students->count();

        while ($totalPlaced < $totalStudents) {
            $placedThisRound = false;

            // Round-robin: one student from each class per round
            foreach ($groupKeys as $classKey) {
                if ($groupIndexes[$classKey] >= count($studentGroups[$classKey])) {
                    continue; // This class exhausted
                }

                $student = $studentGroups[$classKey][$groupIndexes[$classKey]];
                $groupIndexes[$classKey]++;

                // Get next available seat
                if ($currentSeatIndex >= count($currentSeatOrder)) {
                    // Move to next hall
                    $hallIndex++;
                    if ($hallIndex >= $this->halls->count()) {
                        throw new \Exception('Ran out of seats during allocation');
                    }

                    $currentHall = $this->halls[$hallIndex];
                    $currentSeatOrder = $hallSeatOrders[$currentHall->id];
                    $currentSeatIndex = 0;
                }

                $seat = $currentSeatOrder[$currentSeatIndex];
                $currentSeatIndex++;

                // Create allocation record
                $allocations[] = [
                    'allocation_run_id' => $this->allocationRun->id,
                    'exam_id' => $this->exam->id,
                    'hall_id' => $currentHall->id,
                    'student_id' => $student->id,
                    'row' => $seat['row'],
                    'column' => $seat['column'],
                    'seat_number' => $seat['seat_number'],
                    'class_level' => $student->class_level ?? $student->class->name ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $totalPlaced++;
                $placedThisRound = true;
            }

            if (!$placedThisRound) {
                break; // All classes exhausted
            }
        }

        return $allocations;
    }

    /**
     * Detect adjacency conflicts (same class adjacent/front/back)
     */
    protected function detectConflicts($allocations)
    {
        $conflicts = [];
        
        // Group allocations by hall for efficient lookup
        $byHall = [];
        foreach ($allocations as $idx => $allocation) {
            $hallId = $allocation['hall_id'];
            if (!isset($byHall[$hallId])) {
                $byHall[$hallId] = [];
            }
            $byHall[$hallId][] = array_merge($allocation, ['index' => $idx]);
        }

        // Check each hall
        foreach ($byHall as $hallId => $hallAllocations) {
            // Build position map: [row][column] => allocation
            $positionMap = [];
            foreach ($hallAllocations as $alloc) {
                $positionMap[$alloc['row']][$alloc['column']] = $alloc;
            }

            // Check adjacency for each student
            foreach ($hallAllocations as $alloc) {
                $row = $alloc['row'];
                $col = $alloc['column'];
                $class = $alloc['class_level'];

                if (!$class) continue;

                // Check adjacent positions (left, right, front, back)
                $adjacent = [
                    ['row' => $row, 'col' => $col - 1, 'type' => 'same_class_adjacent'],
                    ['row' => $row, 'col' => $col + 1, 'type' => 'same_class_adjacent'],
                    ['row' => $row - 1, 'col' => $col, 'type' => 'same_class_front_back'],
                    ['row' => $row + 1, 'col' => $col, 'type' => 'same_class_front_back'],
                ];

                foreach ($adjacent as $adj) {
                    if (isset($positionMap[$adj['row']][$adj['col']])) {
                        $neighbor = $positionMap[$adj['row']][$adj['col']];
                        
                        if ($neighbor['class_level'] === $class) {
                            $conflicts[] = [
                                'allocation_index' => $alloc['index'],
                                'conflicting_index' => $neighbor['index'],
                                'type' => $adj['type'],
                                'details' => [
                                    'student1' => $alloc['student_id'],
                                    'student2' => $neighbor['student_id'],
                                    'class' => $class,
                                    'positions' => [
                                        ['row' => $row, 'col' => $col],
                                        ['row' => $adj['row'], 'col' => $adj['col']],
                                    ],
                                ],
                            ];
                        }
                    }
                }
            }
        }

        return $conflicts;
    }

    /**
     * Attempt to resolve conflicts via local swaps
     */
    protected function resolveConflicts(&$allocations, &$conflicts)
    {
        $maxAttempts = 1000;
        $attempt = 0;

        while (count($conflicts) > 0 && $attempt < $maxAttempts) {
            $conflict = $conflicts[0];
            
            // Try swapping one of the conflicting students with a non-conflicting seat
            $resolved = $this->attemptSwap($allocations, $conflict);

            if ($resolved) {
                // Re-detect conflicts after swap
                $conflicts = $this->detectConflicts($allocations);
            } else {
                // Move this conflict to end and try next
                array_shift($conflicts);
                $conflicts[] = $conflict;
            }

            $attempt++;
        }

        if (count($conflicts) > 0) {
            Log::warning('Could not resolve all conflicts', [
                'exam_id' => $this->exam->id,
                'remaining_conflicts' => count($conflicts),
            ]);
        }
    }

    /**
     * Attempt to swap a conflicting student with another seat
     */
    protected function attemptSwap(&$allocations, $conflict)
    {
        $idx1 = $conflict['allocation_index'];
        $idx2 = $conflict['conflicting_index'];

        // Try swapping idx1 with a random non-adjacent seat in same hall
        $hallId = $allocations[$idx1]['hall_id'];
        $candidates = [];

        foreach ($allocations as $idx => $alloc) {
            if ($alloc['hall_id'] === $hallId && $idx !== $idx1 && $idx !== $idx2) {
                // Check if this swap would create new conflicts
                if ($alloc['class_level'] !== $allocations[$idx1]['class_level']) {
                    $candidates[] = $idx;
                }
            }
        }

        if (empty($candidates)) {
            return false;
        }

        // Pick random candidate
        $swapIdx = $candidates[array_rand($candidates)];

        // Swap positions
        $temp = [
            'row' => $allocations[$idx1]['row'],
            'column' => $allocations[$idx1]['column'],
            'seat_number' => $allocations[$idx1]['seat_number'],
        ];

        $allocations[$idx1]['row'] = $allocations[$swapIdx]['row'];
        $allocations[$idx1]['column'] = $allocations[$swapIdx]['column'];
        $allocations[$idx1]['seat_number'] = $allocations[$swapIdx]['seat_number'];

        $allocations[$swapIdx]['row'] = $temp['row'];
        $allocations[$swapIdx]['column'] = $temp['column'];
        $allocations[$swapIdx]['seat_number'] = $temp['seat_number'];

        return true;
    }

    /**
     * Save allocations to database
     */
    protected function saveAllocations($allocations)
    {
        foreach (array_chunk($allocations, 500) as $chunk) {
            Allocation::insert($chunk);
        }
    }

    /**
     * Save conflicts to database
     */
    protected function saveConflicts($conflicts)
    {
        if (empty($conflicts)) {
            return;
        }

        // First get allocation IDs from database
        $allAllocations = Allocation::where('allocation_run_id', $this->allocationRun->id)
            ->orderBy('id')
            ->get();

        $conflictRecords = [];

        foreach ($conflicts as $conflict) {
            $alloc1 = $allAllocations[$conflict['allocation_index']] ?? null;
            $alloc2 = $allAllocations[$conflict['conflicting_index']] ?? null;

            if ($alloc1 && $alloc2) {
                $conflictRecords[] = [
                    'allocation_id' => $alloc1->id,
                    'conflicting_allocation_id' => $alloc2->id,
                    'type' => $conflict['type'],
                    'details' => json_encode($conflict['details']),
                    'resolved' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if (!empty($conflictRecords)) {
            foreach (array_chunk($conflictRecords, 500) as $chunk) {
                SeatConflict::insert($chunk);
            }
        }
    }

    /**
     * Update allocation run metadata
     */
    protected function updateMetadata($allocations, $conflicts)
    {
        $hallsUsed = [];
        $classCounts = [];

        foreach ($allocations as $alloc) {
            $hallsUsed[$alloc['hall_id']] = true;
            $class = $alloc['class_level'] ?? 'unassigned';
            $classCounts[$class] = ($classCounts[$class] ?? 0) + 1;
        }

        $this->allocationRun->update([
            'metadata' => [
                'total_students' => count($allocations),
                'total_conflicts' => count($conflicts),
                'halls_used' => count($hallsUsed),
                'class_distribution' => $classCounts,
                'seat_numbering_used' => $this->seatNumbering,
            ],
        ]);
    }
}
