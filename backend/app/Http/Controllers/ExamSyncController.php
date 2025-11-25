<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ExamAttempt;
use App\Services\ExamScoringService;
use Illuminate\Support\Facades\DB;

class ExamSyncController extends Controller
{
    public function sync(Request $request, ExamScoringService $scoring)
    {
        $payload = $request->validate([
            'attempt_uuid' => 'required|string',
            'exam_id' => 'required|integer',
            'student_id' => 'required|integer',
            'device_id' => 'required|string',
            'started_at' => 'required|date',
            'ended_at' => 'required|date',
            'duration_seconds' => 'required|integer',
            'answers' => 'required|array',
            'answers_hash' => 'required|string'
        ]);

        // Idempotency: reject if attempt_uuid already processed
        if (ExamAttempt::where('attempt_uuid', $payload['attempt_uuid'])->exists()) {
            return response()->json(['message' => 'Attempt already processed'], 409);
        }

        DB::beginTransaction();
        try {
            $attempt = ExamAttempt::create([
                'attempt_uuid' => $payload['attempt_uuid'],
                'exam_id' => $payload['exam_id'],
                'student_id' => $payload['student_id'],
                'device_id' => $payload['device_id'],
                'started_at' => $payload['started_at'],
                'ended_at' => $payload['ended_at'],
                'duration_seconds' => $payload['duration_seconds'],
                'status' => 'received'
            ]);

            // Save answers - simplified: real impl should insert into student_answers
            // Score using the scoring service
            $score = $scoring->score($payload['exam_id'], $payload['answers']);

            $attempt->score = $score;
            $attempt->status = 'scored';
            $attempt->synced_at = now();
            $attempt->save();

            DB::commit();
            return response()->json(['attempt_id' => $attempt->id, 'score' => $score]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Sync failed', 'error' => $e->getMessage()], 500);
        }
    }
}
