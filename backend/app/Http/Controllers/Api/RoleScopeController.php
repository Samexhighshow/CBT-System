<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoleScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleScopeController extends Controller
{
    private function pendingScopeQueryByBatch(string $batchId)
    {
        if (str_starts_with($batchId, 'legacy-')) {
            $legacyId = (int) str_replace('legacy-', '', $batchId);
            return RoleScope::query()
                ->where('id', $legacyId)
                ->where('role_name', 'teacher')
                ->where('status', 'pending');
        }

        return RoleScope::query()
            ->where('request_batch_id', $batchId)
            ->where('role_name', 'teacher')
            ->where('status', 'pending');
    }

    public function index(Request $request): JsonResponse
    {
        $query = RoleScope::query()
            ->with([
                'user:id,name,email',
                'requester:id,name,email',
                'approver:id,name,email',
                'subject:id,name,code,class_level',
                'schoolClass:id,name',
                'exam:id,title,subject_id,class_id',
            ])
            ->orderByDesc('id');

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        if ($request->filled('role_name')) {
            $query->where('role_name', strtolower(trim((string) $request->input('role_name'))));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('status')) {
            $query->where('status', strtolower(trim((string) $request->input('status'))));
        }

        return response()->json($query->paginate((int) $request->input('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'role_name' => ['nullable', 'string', 'max:80'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'class_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'exam_id' => ['nullable', 'integer', 'exists:exams,id'],
            'academic_session' => ['nullable', 'string', 'max:64'],
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
            'rejected_reason' => ['nullable', 'string', 'max:500'],
        ]);

        if (
            empty($validated['subject_id'])
            && empty($validated['class_id'])
            && empty($validated['exam_id'])
        ) {
            return response()->json([
                'message' => 'At least one of subject_id, class_id, or exam_id is required.',
            ], 422);
        }

        $validated['role_name'] = isset($validated['role_name']) && $validated['role_name'] !== ''
            ? strtolower(trim((string) $validated['role_name']))
            : null;
        $validated['status'] = strtolower(trim((string) ($validated['status'] ?? 'approved')));
        $validated['is_active'] = (bool) ($validated['is_active'] ?? ($validated['status'] === 'approved'));
        $validated['requested_by'] = $validated['requested_by'] ?? $request->user()?->id;
        $validated['approved_by'] = $validated['status'] === 'approved' ? $request->user()?->id : null;
        $validated['approved_at'] = $validated['status'] === 'approved' ? now() : null;

        $scope = RoleScope::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'role_name' => $validated['role_name'],
                'subject_id' => $validated['subject_id'] ?? null,
                'class_id' => $validated['class_id'] ?? null,
                'exam_id' => $validated['exam_id'] ?? null,
                'academic_session' => $validated['academic_session'] ?? null,
                'term' => $validated['term'] ?? null,
            ],
            [
                'is_active' => $validated['is_active'],
                'status' => $validated['status'],
                'requested_by' => $validated['requested_by'],
                'approved_by' => $validated['approved_by'],
                'approved_at' => $validated['approved_at'],
                'rejected_reason' => $validated['status'] === 'rejected' ? ($validated['rejected_reason'] ?? null) : null,
            ]
        );

        return response()->json([
            'message' => 'Role scope saved successfully.',
            'data' => $scope->load(['user:id,name,email', 'requester:id,name,email', 'approver:id,name,email', 'subject:id,name', 'schoolClass:id,name', 'exam:id,title']),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $scope = RoleScope::findOrFail($id);
        $validated = $request->validate([
            'role_name' => ['nullable', 'string', 'max:80'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'class_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'exam_id' => ['nullable', 'integer', 'exists:exams,id'],
            'academic_session' => ['nullable', 'string', 'max:64'],
            'term' => ['nullable', Rule::in(['First Term', 'Second Term', 'Third Term'])],
            'is_active' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
            'rejected_reason' => ['nullable', 'string', 'max:500'],
        ]);

        if (array_key_exists('role_name', $validated)) {
            $validated['role_name'] = $validated['role_name'] !== null && trim((string) $validated['role_name']) !== ''
                ? strtolower(trim((string) $validated['role_name']))
                : null;
        }
        if (array_key_exists('status', $validated)) {
            $validated['status'] = strtolower(trim((string) $validated['status']));
            if ($validated['status'] === 'approved') {
                $validated['is_active'] = true;
                $validated['approved_by'] = $request->user()?->id;
                $validated['approved_at'] = now();
                $validated['rejected_reason'] = null;
            } elseif ($validated['status'] === 'rejected') {
                $validated['is_active'] = false;
                $validated['approved_by'] = null;
                $validated['approved_at'] = null;
            }
        }

        $scope->fill($validated);
        $scope->save();

        return response()->json([
            'message' => 'Role scope updated successfully.',
            'data' => $scope->load(['user:id,name,email', 'requester:id,name,email', 'approver:id,name,email', 'subject:id,name', 'schoolClass:id,name', 'exam:id,title']),
        ]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $scope = RoleScope::findOrFail($id);
        $scope->update([
            'status' => 'approved',
            'is_active' => true,
            'approved_by' => $request->user()?->id,
            'approved_at' => now(),
            'rejected_reason' => null,
        ]);

        return response()->json([
            'message' => 'Scope request approved.',
            'data' => $scope->fresh()->load(['user:id,name,email', 'requester:id,name,email', 'approver:id,name,email', 'subject:id,name', 'schoolClass:id,name', 'exam:id,title']),
        ]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $scope = RoleScope::findOrFail($id);
        $scope->update([
            'status' => 'rejected',
            'is_active' => false,
            'approved_by' => null,
            'approved_at' => null,
            'rejected_reason' => $validated['reason'],
        ]);

        return response()->json([
            'message' => 'Scope request rejected.',
            'data' => $scope->fresh()->load(['user:id,name,email', 'requester:id,name,email', 'approver:id,name,email', 'subject:id,name', 'schoolClass:id,name', 'exam:id,title']),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $scope = RoleScope::findOrFail($id);
        $scope->delete();

        return response()->json([
            'message' => 'Role scope deleted successfully.',
        ]);
    }

    public function pendingTeacherRequests(Request $request): JsonResponse
    {
        $rows = RoleScope::query()
            ->where('role_name', 'teacher')
            ->where('status', 'pending')
            ->with([
                'user:id,name,email',
                'subject:id,name,code',
                'schoolClass:id,name',
            ])
            ->orderByDesc('id')
            ->get();

        $grouped = $rows
            ->groupBy(fn (RoleScope $scope) => $scope->request_batch_id ?: ('legacy-' . $scope->id))
            ->map(function ($scopes, $batchId) {
                $first = $scopes->first();
                $userId = (int) ($first->user_id ?? 0);

                $currentApproved = RoleScope::query()
                    ->where('user_id', $userId)
                    ->where('role_name', 'teacher')
                    ->where('status', 'approved')
                    ->where('is_active', true)
                    ->with(['subject:id,name,code', 'schoolClass:id,name'])
                    ->orderBy('subject_id')
                    ->orderBy('class_id')
                    ->get();

                return [
                    'batch_id' => (string) $batchId,
                    'user' => [
                        'id' => $userId,
                        'name' => (string) ($first->user?->name ?? ''),
                        'email' => (string) ($first->user?->email ?? ''),
                    ],
                    'reason' => (string) ($first->request_reason ?? ''),
                    'requested_at' => (string) ($scopes->max('created_at') ?? ''),
                    'requested_scopes' => $scopes->map(function (RoleScope $scope) {
                        return [
                            'id' => (int) $scope->id,
                            'subject_id' => (int) ($scope->subject_id ?? 0),
                            'subject_name' => (string) ($scope->subject?->name ?? ''),
                            'class_id' => (int) ($scope->class_id ?? 0),
                            'class_name' => (string) ($scope->schoolClass?->name ?? ''),
                        ];
                    })->values(),
                    'current_approved_scopes' => $currentApproved->map(function (RoleScope $scope) {
                        return [
                            'id' => (int) $scope->id,
                            'subject_id' => (int) ($scope->subject_id ?? 0),
                            'subject_name' => (string) ($scope->subject?->name ?? ''),
                            'class_id' => (int) ($scope->class_id ?? 0),
                            'class_name' => (string) ($scope->schoolClass?->name ?? ''),
                        ];
                    })->values(),
                ];
            })
            ->values();

        return response()->json([
            'pending_requests' => $grouped,
            'total' => $grouped->count(),
        ]);
    }

    public function approveTeacherRequestBatch(Request $request, string $batchId): JsonResponse
    {
        $adminId = (int) ($request->user()?->id ?? 0);

        $approvedCount = DB::transaction(function () use ($batchId, $adminId) {
            $pendingScopes = $this->pendingScopeQueryByBatch($batchId)
                ->lockForUpdate()
                ->get();

            if ($pendingScopes->isEmpty()) {
                return 0;
            }

            $userId = (int) $pendingScopes->first()->user_id;

            RoleScope::query()
                ->where('user_id', $userId)
                ->where('role_name', 'teacher')
                ->where('status', 'approved')
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $ids = $pendingScopes->pluck('id')->map(fn ($id) => (int) $id)->values();

            RoleScope::query()
                ->whereIn('id', $ids)
                ->update([
                    'status' => 'approved',
                    'is_active' => true,
                    'approved_by' => $adminId > 0 ? $adminId : null,
                    'approved_at' => now(),
                    'rejected_reason' => null,
                ]);

            RoleScope::query()
                ->where('user_id', $userId)
                ->where('role_name', 'teacher')
                ->where('status', 'pending')
                ->whereNotIn('id', $ids)
                ->update([
                    'status' => 'rejected',
                    'is_active' => false,
                    'rejected_reason' => 'Superseded by another approved scope request.',
                    'approved_by' => null,
                    'approved_at' => null,
                ]);

            return $ids->count();
        });

        if ($approvedCount === 0) {
            return response()->json([
                'message' => 'Pending request not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Teacher scope request approved successfully.',
            'approved_rows' => $approvedCount,
        ]);
    }

    public function rejectTeacherRequestBatch(Request $request, string $batchId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $updated = $this->pendingScopeQueryByBatch($batchId)->update([
            'status' => 'rejected',
            'is_active' => false,
            'rejected_reason' => (string) $validated['reason'],
            'approved_by' => null,
            'approved_at' => null,
        ]);

        if ($updated === 0) {
            return response()->json([
                'message' => 'Pending request not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Teacher scope request rejected.',
            'rejected_rows' => $updated,
        ]);
    }
}
