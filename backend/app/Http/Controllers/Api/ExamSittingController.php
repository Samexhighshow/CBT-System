<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamSitting;
use App\Models\SystemSetting;
use App\Services\RoleScopeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ExamSittingController extends Controller
{
    public function __construct(
        private readonly RoleScopeService $roleScopeService
    ) {
    }

    public function index(Request $request, int $examId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $query = ExamSitting::where('exam_id', $exam->id);

        if ($request->filled('assessment_mode_snapshot')) {
            $query->where('assessment_mode_snapshot', $this->normalizeMode((string) $request->input('assessment_mode_snapshot')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'exam_id' => $exam->id,
            'sittings' => $query->orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request, int $examId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'session' => 'nullable|string|max:64',
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'assessment_mode_snapshot' => ['nullable', Rule::in(['ca_test', 'exam'])],
            'question_count' => 'nullable|integer|min:1',
            'duration_minutes' => 'nullable|integer|min:1|max:300',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after:start_at',
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'active', 'closed'])],
            'results_released' => 'nullable|boolean',
            'title_override' => 'nullable|string|max:255',
            'instructions_override' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $mode = $request->filled('assessment_mode_snapshot')
            ? $this->normalizeMode((string) $request->input('assessment_mode_snapshot'))
            : $this->resolveModeSnapshot($exam);

        $sitting = ExamSitting::create([
            'exam_id' => $exam->id,
            'session' => $request->input('session', $exam->academic_session),
            'term' => $request->input('term', $exam->term),
            'assessment_mode_snapshot' => $mode,
            'question_count' => $request->input('question_count', $this->resolveQuestionCount($exam)),
            'duration_minutes' => $request->input('duration_minutes', $exam->duration_minutes),
            'start_at' => $request->input('start_at', $exam->start_datetime ?? $exam->start_time),
            'end_at' => $request->input('end_at', $exam->end_datetime ?? $exam->end_time),
            'status' => $request->input('status', 'draft'),
            'results_released' => $request->boolean('results_released', false),
            'title_override' => $request->input('title_override'),
            'instructions_override' => $request->input('instructions_override'),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Exam sitting created successfully.',
            'sitting' => $sitting,
        ], 201);
    }

    public function update(Request $request, int $examId, int $sittingId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $sitting = ExamSitting::where('exam_id', $exam->id)->findOrFail($sittingId);

        $validator = Validator::make($request->all(), [
            'session' => 'nullable|string|max:64',
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'assessment_mode_snapshot' => ['nullable', Rule::in(['ca_test', 'exam'])],
            'question_count' => 'nullable|integer|min:1',
            'duration_minutes' => 'nullable|integer|min:1|max:300',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after:start_at',
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'active', 'closed'])],
            'results_released' => 'nullable|boolean',
            'title_override' => 'nullable|string|max:255',
            'instructions_override' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->filled('assessment_mode_snapshot')) {
            $attemptCount = $sitting->attempts()->count();
            if ($attemptCount > 0 && $request->input('assessment_mode_snapshot') !== $sitting->assessment_mode_snapshot) {
                return response()->json([
                    'message' => 'Assessment mode cannot be changed after attempts exist for a sitting.',
                ], 422);
            }

            $sitting->assessment_mode_snapshot = $this->normalizeMode((string) $request->input('assessment_mode_snapshot'));
        }

        $sitting->fill($request->only([
            'session',
            'term',
            'question_count',
            'duration_minutes',
            'start_at',
            'end_at',
            'status',
            'results_released',
            'title_override',
            'instructions_override',
        ]));

        $sitting->save();

        return response()->json([
            'message' => 'Exam sitting updated successfully.',
            'sitting' => $sitting,
        ]);
    }

    public function destroy(Request $request, int $examId, int $sittingId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $sitting = ExamSitting::where('exam_id', $exam->id)->findOrFail($sittingId);
        $attemptCount = $sitting->attempts()->count();
        if ($attemptCount > 0) {
            return response()->json([
                'message' => 'Cannot delete a sitting that already has attempts.',
                'attempt_count' => $attemptCount,
            ], 422);
        }

        $sitting->delete();

        return response()->json([
            'message' => 'Exam sitting deleted successfully.',
            'id' => $sittingId,
        ]);
    }

    public function duplicate(Request $request, int $examId, int $sittingId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $source = ExamSitting::where('exam_id', $exam->id)->findOrFail($sittingId);

        $copy = ExamSitting::create([
            'exam_id' => $exam->id,
            'session' => $request->input('session', $source->session),
            'term' => $request->input('term', $source->term),
            'assessment_mode_snapshot' => $request->input('assessment_mode_snapshot', $source->assessment_mode_snapshot),
            'question_count' => $request->input('question_count', $source->question_count),
            'duration_minutes' => $request->input('duration_minutes', $source->duration_minutes),
            'start_at' => $request->input('start_at', $source->start_at),
            'end_at' => $request->input('end_at', $source->end_at),
            'status' => $request->input('status', 'draft'),
            'results_released' => $request->boolean('results_released', false),
            'title_override' => $request->input('title_override', $source->title_override),
            'instructions_override' => $request->input('instructions_override', $source->instructions_override),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Exam sitting duplicated successfully.',
            'sitting' => $copy,
            'source_id' => $source->id,
        ], 201);
    }

    public function bulkStatusUpdate(Request $request, int $examId)
    {
        if (!$this->isSittingLayerAvailable()) {
            return response()->json(['message' => 'Exam sitting layer is not available until migrations are applied.'], 503);
        }

        $exam = Exam::findOrFail($examId);
        if (!$this->roleScopeService->canManageExam($request->user(), $exam)) {
            return response()->json(['message' => 'Forbidden: outside role scope.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'sitting_ids' => 'required|array|min:1',
            'sitting_ids.*' => 'integer|min:1',
            'status' => ['required', Rule::in(['draft', 'scheduled', 'active', 'closed'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $ids = collect($request->input('sitting_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        $status = (string) $request->input('status');

        $updated = ExamSitting::where('exam_id', $exam->id)
            ->whereIn('id', $ids)
            ->update(['status' => $status]);

        return response()->json([
            'message' => 'Sitting statuses updated successfully.',
            'updated_count' => $updated,
            'status' => $status,
        ]);
    }

    private function normalizeMode(string $raw): string
    {
        $mode = strtolower(trim($raw));
        if ($mode === 'ca' || $mode === 'catest') {
            return 'ca_test';
        }

        return $mode === 'exam' ? 'exam' : 'ca_test';
    }

    private function resolveModeSnapshot(Exam $exam): string
    {
        $mode = strtolower(trim((string) SystemSetting::get('assessment_display_mode', 'auto')));
        if (in_array($mode, ['ca_test', 'exam'], true)) {
            return $mode;
        }

        $assessmentType = strtolower(trim((string) ($exam->assessment_type ?? '')));
        return $assessmentType === 'ca test' ? 'ca_test' : 'exam';
    }

    private function resolveQuestionCount(Exam $exam): ?int
    {
        $count = (int) DB::table('exam_questions')->where('exam_id', $exam->id)->count();
        return $count > 0 ? $count : null;
    }

    private function isSittingLayerAvailable(): bool
    {
        static $available = null;

        if ($available === null) {
            $available = Schema::hasTable('exam_sittings');
        }

        return $available;
    }
}
