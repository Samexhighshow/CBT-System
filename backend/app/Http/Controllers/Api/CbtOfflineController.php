<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\Student;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CbtOfflineController extends Controller
{
    public function offlineUsers(Request $request): JsonResponse
    {
        $since = $this->parseSince($request->query('since'));

        $query = User::query()
            ->with('roles:id,name')
            ->whereHas('roles', function ($roleQuery) {
                $roleQuery->whereIn('name', ['Admin', 'Main Admin', 'Teacher']);
            });

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        $data = $query
            ->orderBy('id')
            ->get()
            ->map(function (User $user) {
                $role = $user->roles->first()?->name ?? 'Admin';
                return [
                    'userId' => $user->id,
                    'identifier' => strtolower((string) $user->email),
                    'role' => $role,
                    'isActive' => true,
                    'offlineLoginEnabled' => (bool) $user->offline_login_enabled,
                    'pinHash' => (string) ($user->offline_pin_hash ?? ''),
                    'displayName' => $user->name,
                    'lastSyncAt' => optional($user->updated_at)->toIso8601String(),
                    'updatedAt' => optional($user->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'data' => $data,
            'synced_at' => now()->toIso8601String(),
        ]);
    }

    public function offlineStudents(Request $request): JsonResponse
    {
        $since = $this->parseSince($request->query('since'));
        $classId = $request->query('class_id');

        $query = Student::query()->where(function ($q) {
            $q->where('is_active', true)->orWhereNull('is_active');
        });

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        if ($classId !== null && $classId !== '') {
            $query->where('class_id', (int) $classId);
        }

        $data = $query
            ->orderBy('id')
            ->get()
            ->map(function (Student $student) {
                $fullName = trim(implode(' ', array_filter([
                    $student->first_name,
                    $student->last_name,
                    $student->other_names,
                ])));

                return [
                    'studentId' => $student->id,
                    'matricOrCandidateNo' => (string) ($student->registration_number ?: $student->student_id),
                    'fullName' => $fullName !== '' ? $fullName : (string) $student->email,
                    'classId' => $student->class_id,
                    'isActive' => (bool) ($student->is_active ?? true),
                    'updatedAt' => optional($student->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'data' => $data,
            'synced_at' => now()->toIso8601String(),
        ]);
    }

    public function offlineExams(Request $request): JsonResponse
    {
        $since = $this->parseSince($request->query('since'));
        $classId = $request->query('class_id');

        $query = Exam::query()
            ->where('published', true)
            ->whereIn('status', ['scheduled', 'active']);

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        if ($classId !== null && $classId !== '') {
            $query->where(function ($classQuery) use ($classId) {
                $classQuery->where('class_id', (int) $classId)
                    ->orWhere('class_level_id', (int) $classId);
            });
        }

        $data = $query
            ->orderByRaw('COALESCE(start_datetime, start_time) asc')
            ->get()
            ->map(function (Exam $exam) {
                $startsAt = $exam->start_datetime ?? $exam->start_time;
                $endsAt = $exam->end_datetime ?? $exam->end_time;

                return [
                    'examId' => $exam->id,
                    'title' => $exam->title,
                    'classId' => $exam->class_id ?? $exam->class_level_id,
                    'status' => $exam->status,
                    'startsAt' => $startsAt?->toIso8601String(),
                    'endsAt' => $endsAt?->toIso8601String(),
                    'durationMinutes' => $exam->duration_minutes,
                    'updatedAt' => optional($exam->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'data' => $data,
            'synced_at' => now()->toIso8601String(),
        ]);
    }

    public function syncAccessCodes(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codes' => 'required|array|min:1',
            'codes.*.codeId' => 'required|string|max:64',
            'codes.*.examId' => 'required|integer|exists:exams,id',
            'codes.*.studentId' => 'required|integer|exists:students,id',
            'codes.*.code' => 'required|string|max:64',
            'codes.*.status' => 'nullable|in:NEW,USED,VOID',
            'codes.*.issuedAt' => 'nullable|date',
            'codes.*.usedAt' => 'nullable|date',
            'codes.*.attemptId' => 'nullable|string|max:64',
            'codes.*.usedByDeviceId' => 'nullable|string|max:128',
            'codes.*.updatedAt' => 'nullable|date',
        ]);

        $processed = 0;
        DB::beginTransaction();

        try {
            foreach ($validated['codes'] as $row) {
                $examId = (int) $row['examId'];
                $studentId = (int) $row['studentId'];
                $codeId = (string) $row['codeId'];
                $status = strtoupper((string) ($row['status'] ?? 'NEW'));
                $isUsed = in_array($status, ['USED', 'VOID'], true);
                $exam = Exam::find($examId);
                $student = Student::find($studentId);
                if (!$exam || !$student) {
                    continue;
                }

                $existing = ExamAccess::where('client_code_id', $codeId)->first();
                if (!$existing) {
                    $existing = ExamAccess::where('exam_id', $examId)
                        ->where('student_id', $studentId)
                        ->latest('id')
                        ->first();
                }

                if (!$existing) {
                    $existing = new ExamAccess();
                }

                $expiresAt = $exam->end_datetime ?? $exam->end_time ?? now()->endOfDay();

                $existing->fill([
                    'client_code_id' => $codeId,
                    'exam_id' => $examId,
                    'student_id' => $studentId,
                    'student_reg_number' => (string) ($student->registration_number ?: $student->student_id),
                    'access_code' => strtoupper((string) $row['code']),
                    'status' => $status,
                    'used' => $isUsed,
                    'used_at' => $row['usedAt'] ?? ($isUsed ? now() : null),
                    'used_by_device_id' => $row['usedByDeviceId'] ?? null,
                    'attempt_uuid' => $row['attemptId'] ?? null,
                    'expires_at' => $expiresAt,
                ]);

                if (!$existing->exists && !empty($row['issuedAt'])) {
                    $existing->setAttribute('created_at', Carbon::parse($row['issuedAt']));
                }
                if (!empty($row['updatedAt'])) {
                    $existing->setAttribute('updated_at', Carbon::parse($row['updatedAt']));
                }

                $existing->save();
                $processed++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to sync access codes',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Access codes synced',
            'processed' => $processed,
        ]);
    }

    public function syncCodeUsage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codeId' => 'required|string|max:64',
            'usedAt' => 'nullable|date',
            'attemptId' => 'nullable|string|max:64',
            'deviceId' => 'nullable|string|max:128',
            'status' => 'nullable|in:USED,VOID',
            'updatedAt' => 'nullable|date',
        ]);

        $code = ExamAccess::where('client_code_id', $validated['codeId'])->first();
        if (!$code) {
            return response()->json([
                'message' => 'Code usage accepted (code not found on server yet)',
                'ignored' => true,
            ]);
        }

        $status = strtoupper((string) ($validated['status'] ?? 'USED'));
        $usedAt = $validated['usedAt'] ?? now();

        $code->update([
            'status' => $status,
            'used' => true,
            'used_at' => $usedAt,
            'attempt_uuid' => $validated['attemptId'] ?? $code->attempt_uuid,
            'used_by_device_id' => $validated['deviceId'] ?? $code->used_by_device_id,
        ]);

        if (!empty($validated['updatedAt'])) {
            $code->updated_at = Carbon::parse($validated['updatedAt']);
            $code->save();
        }

        return response()->json([
            'message' => 'Code usage synced',
            'code_id' => $code->id,
        ]);
    }

    private function parseSince($since): ?Carbon
    {
        if (!$since) {
            return null;
        }

        try {
            return Carbon::parse((string) $since);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
