<?php

namespace App\Jobs;

use App\Models\AllocationRun;
use App\Models\Exam;
use App\Services\AllocationEngine;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateAllocation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $allocationRunId;

    /**
     * Create a new job instance.
     */
    public function __construct($allocationRunId)
    {
        $this->allocationRunId = $allocationRunId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $run = AllocationRun::findOrFail($this->allocationRunId);
        $exam = Exam::findOrFail($run->exam_id);

        try {
            $engine = new AllocationEngine(
                $exam,
                $run,
                $run->mode,
                $run->seat_numbering,
                $run->adjacency_strictness
            );

            $result = $engine->execute();

            Log::info('Allocation job completed', [
                'allocation_run_id' => $this->allocationRunId,
                'result' => $result,
            ]);

        } catch (\Exception $e) {
            Log::error('Allocation job failed', [
                'allocation_run_id' => $this->allocationRunId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }
}
