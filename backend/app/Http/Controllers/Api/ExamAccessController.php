<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ExamAccessController extends Controller
{
    /**
     * Get all exam access records.
     */
    public function index()
    {
        try {
            $this->normalizeLegacyUnusedCodes();

            $accessRecords = ExamAccess::with(['exam:id,title', 'student:id,registration_number,first_name,last_name'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function (ExamAccess $access) {
                    $studentName = $access->student
                        ? trim($access->student->first_name . ' ' . $access->student->last_name)
                        : 'Unknown';

                    return [
                        'id' => $access->id,
                        'code_id' => $access->client_code_id,
                        'exam_id' => $access->exam_id,
                        'student_id' => $access->student_id,
                        'student_reg_number' => $access->student_reg_number ?? $access->student?->registration_number ?? 'N/A',
                        'student_name' => $studentName,
                        'exam_title' => $access->exam->title ?? 'Unknown Exam',
                        'access_code' => $access->access_code,
                        'status' => $access->status ?? ($access->used ? 'USED' : 'NEW'),
                        'used' => (bool) $access->used,
                        'used_at' => $access->used_at,
                        'generated_at' => $access->created_at,
                        'expires_at' => $access->expires_at,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $accessRecords,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch exam access records',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate access codes for students.
     */
    public function generate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'exam_id' => 'required|exists:exams,id',
            'student_id' => 'sometimes|exists:students,id',
            'reg_numbers' => 'sometimes|array|min:1',
            'reg_numbers.*' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $exam = Exam::findOrFail($request->exam_id);
            $generated = [];
            $errors = [];

            if ($request->has('student_id')) {
                $student = Student::findOrFail($request->student_id);
                $expiresAt = $this->resolveExpiryForExam($exam);

                [$access, $rotatedCount] = DB::transaction(function () use ($exam, $student, $expiresAt) {
                    $rotatedCount = $this->rotateUnusedCodes($exam->id, $student->id);
                    $accessCode = ExamAccess::generateUniqueCode();

                    $access = ExamAccess::create([
                        'client_code_id' => (string) Str::uuid(),
                        'exam_id' => $exam->id,
                        'student_id' => $student->id,
                        'student_reg_number' => $student->registration_number,
                        'access_code' => $accessCode,
                        'status' => 'NEW',
                        'used' => false,
                        'expires_at' => $expiresAt,
                    ]);

                    return [$access, $rotatedCount];
                });

                return response()->json([
                    'success' => true,
                    'message' => $rotatedCount > 0
                        ? 'Access code regenerated successfully. Previous unused code(s) were invalidated.'
                        : 'Access code generated successfully',
                    'data' => [
                        'id' => $access->id,
                        'access_code' => $access->access_code,
                        'student_name' => trim($student->first_name . ' ' . $student->last_name),
                        'student_reg_number' => $student->registration_number,
                        'exam_title' => $exam->title,
                        'generated_at' => $access->created_at,
                        'expires_at' => $expiresAt,
                        'invalidated_previous_unused_codes' => $rotatedCount,
                    ],
                ], 201);
            }

            $regNumbers = $request->reg_numbers ?? [];

            foreach ($regNumbers as $regNumberInput) {
                $regNumber = strtoupper(trim((string) $regNumberInput));
                if ($regNumber === '') {
                    continue;
                }

                $student = Student::where('registration_number', $regNumber)->first();

                if (!$student) {
                    $errors[] = "Student with reg number {$regNumber} not found";
                    continue;
                }
                $expiresAt = $this->resolveExpiryForExam($exam);
                $accessCode = null;
                $rotatedCount = 0;

                DB::transaction(function () use ($exam, $student, $expiresAt, &$accessCode, &$rotatedCount) {
                    $rotatedCount = $this->rotateUnusedCodes($exam->id, $student->id);
                    $accessCode = ExamAccess::generateUniqueCode();

                    ExamAccess::create([
                        'client_code_id' => (string) Str::uuid(),
                        'exam_id' => $exam->id,
                        'student_id' => $student->id,
                        'student_reg_number' => $student->registration_number,
                        'access_code' => $accessCode,
                        'status' => 'NEW',
                        'used' => false,
                        'expires_at' => $expiresAt,
                    ]);
                });

                $generated[] = [
                    'reg_number' => $student->registration_number,
                    'student_name' => trim($student->first_name . ' ' . $student->last_name),
                    'access_code' => $accessCode,
                    'invalidated_previous_unused_codes' => $rotatedCount,
                ];
            }

            $message = count($generated) . ' access code(s) generated successfully';
            if (count($errors) > 0) {
                $message .= '. ' . count($errors) . ' error(s) occurred.';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'generated' => $generated,
                    'errors' => $errors,
                ],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate access codes',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify an access code and allow resume if attempt is still in-progress.
     */
    public function verify(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'access_code' => 'required|string',
            'exam_id' => 'nullable|exists:exams,id',
            'reg_number' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $accessCode = strtoupper((string) $request->input('access_code'));
            $regNumber = strtoupper((string) $request->input('reg_number', ''));

            $query = ExamAccess::where('access_code', $accessCode);

            if ($request->filled('exam_id')) {
                $query->where('exam_id', $request->input('exam_id'));
            }

            if ($regNumber !== '') {
                $query->where(function ($q) use ($regNumber) {
                    $q->where('student_reg_number', $regNumber)
                        ->orWhereHas('student', function ($sq) use ($regNumber) {
                            $sq->where('registration_number', $regNumber);
                        });
                });
            }

            $access = $query->first();

            if (!$access) {
                $crossExamAccess = ExamAccess::where('access_code', $accessCode)->latest('id')->first();
                if ($crossExamAccess) {
                    $studentForCode = $crossExamAccess->student;
                    $belongsToSameStudent = $regNumber === '' || (
                        $studentForCode && strtoupper((string) $studentForCode->registration_number) === $regNumber
                    ) || strtoupper((string) ($crossExamAccess->student_reg_number ?? '')) === $regNumber;

                    if ($belongsToSameStudent) {
                        $otherExamTitle = Exam::where('id', $crossExamAccess->exam_id)->value('title');
                        return response()->json([
                            'success' => false,
                            'message' => $otherExamTitle
                                ? "Access code belongs to a different exam ({$otherExamTitle}). Please select the correct exam."
                                : 'Access code belongs to a different exam. Please select the correct exam.',
                        ], 403);
                    }
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Invalid access code for this exam',
                ], 403);
            }

            if (strtoupper((string) ($access->status ?? 'NEW')) === 'VOID') {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code is no longer valid. Request a replacement code.',
                ], 403);
            }

            if ($access->expires_at && $access->expires_at->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code has expired',
                ], 403);
            }

            $student = $access->student;
            $exam = Exam::find($access->exam_id);
            $attemptMode = $this->resolveAttemptMode($exam);

            if ($regNumber !== '' && $student && strtoupper((string) $student->registration_number) !== $regNumber) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access code does not match this registration number',
                ], 403);
            }

            $resumableAttempt = null;
            if ($student) {
                $resumableAttempt = ExamAttempt::where('exam_id', $access->exam_id)
                    ->where('student_id', $student->id)
                    ->whereIn('status', ['pending', 'in_progress'])
                    ->where(function ($q) use ($attemptMode) {
                        $this->applyAttemptModeScope($q, $attemptMode);
                    })
                    ->where(function ($q) {
                        $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
                    })
                    ->latest('id')
                    ->first();
            }

            if (!$resumableAttempt && $student) {
                $latestAttempt = ExamAttempt::where('exam_id', $access->exam_id)
                    ->where('student_id', $student->id)
                    ->where(function ($q) use ($attemptMode) {
                        $this->applyAttemptModeScope($q, $attemptMode);
                    })
                    ->latest('id')
                    ->first();

                // Allow session replacement: if a new unused access code is provided and there's a previous attempt,
                // void the old attempt to allow a fresh start
                if ($latestAttempt && !$access->used) {
                    $latestStatus = strtolower((string) ($latestAttempt->status ?? ''));
                    $latestIsInProgress = in_array($latestStatus, ['pending', 'in_progress'], true);
                    $allowRetakes = SystemSetting::get('allow_exam_retakes', '0');

                    // Check if this is a new access code (generated after the latest attempt)
                    if (
                        $latestIsInProgress
                        && $access->created_at
                        && $latestAttempt->created_at
                        && $access->created_at > $latestAttempt->created_at
                    ) {
                        // Session replacement for in-progress attempt.
                        $latestAttempt->update([
                            'status' => 'voided',
                            'updated_at' => now(),
                        ]);
                        $latestAttempt = null;
                    } else {
                        // Old access code or exam retake not allowed
                        if ($allowRetakes !== '1' && $allowRetakes !== 1 && $allowRetakes !== true) {
                            return response()->json([
                                'success' => false,
                                'message' => 'Student already has an attempt for this exam. New token cannot restart it.',
                                'attempt_status' => $latestAttempt->status,
                            ], 409);
                        }
                        // Preserve completed/submitted attempt history for compilation.
                        if ($latestIsInProgress) {
                            $latestAttempt->update([
                                'status' => 'voided',
                                'updated_at' => now(),
                            ]);
                            $latestAttempt = null;
                        }
                    }
                }
            }

            if ($access->used && !$resumableAttempt) {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code has already been used',
                    'used_at' => $access->used_at,
                ], 403);
            }

            if (!$access->used) {
                $access->markAsUsed();
            }

            return response()->json([
                'success' => true,
                'message' => 'Access code verified successfully',
                'data' => [
                    'student_id' => $student?->id ?? $access->student_id,
                    'exam_id' => $access->exam_id,
                    'attempt_id' => $resumableAttempt?->id,
                    'resume_available' => (bool) $resumableAttempt,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to verify access code',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Revoke an access code (delete unused code).
     */
    public function destroy($id)
    {
        try {
            $access = ExamAccess::findOrFail($id);

            if ($access->used) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot revoke a used access code',
                ], 400);
            }

            $access->delete();

            return response()->json([
                'success' => true,
                'message' => 'Access code revoked successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to revoke access code',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get exams available for today's access-code generation window.
     * Includes multi-day exams whose start/end range overlaps today.
     */
    public function getTodayExams()
    {
        try {
            $todayStart = Carbon::today()->startOfDay();
            $todayEnd = Carbon::today()->endOfDay();

            $exams = Exam::with('subject:id,name')
                ->where('published', true)
                ->whereIn('status', ['scheduled', 'active'])
                ->orderByRaw('COALESCE(start_datetime, start_time) asc')
                ->get()
                ->filter(function (Exam $exam) use ($todayStart, $todayEnd) {
                    $start = $exam->start_datetime ?? $exam->start_time;
                    $end = $exam->end_datetime ?? $exam->end_time;

                    // No schedule set: keep available (legacy records).
                    if (!$start && !$end) {
                        return true;
                    }

                    // Open-ended from a start time onward.
                    if ($start && !$end) {
                        return $start->lte($todayEnd);
                    }

                    // Open-ended until an end time.
                    if (!$start && $end) {
                        return $end->gte($todayStart);
                    }

                    // Standard window overlap check for today.
                    return $start->lte($todayEnd) && $end->gte($todayStart);
                })
                ->values()
                ->map(function (Exam $exam) {
                    $start = $exam->start_datetime ?? $exam->start_time;
                    $end = $exam->end_datetime ?? $exam->end_time;

                    return [
                        'id' => $exam->id,
                        'title' => $exam->title,
                        'subject_name' => $exam->subject->name ?? 'Unknown',
                        'date' => optional($start)->toDateString(),
                        'start_time' => optional($start)->format('H:i'),
                        'end_time' => optional($end)->format('H:i'),
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $exams,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available exams',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function resolveExpiryForExam(Exam $exam): Carbon
    {
        $examEnd = $exam->end_datetime ?? $exam->end_time;

        if ($examEnd instanceof Carbon) {
            return $examEnd->copy();
        }

        return Carbon::today()->endOfDay();
    }

    /**
     * Invalidate any existing unused code for same exam/student before generating a new one.
     * This allows unlimited regeneration while ensuring only the latest code remains active.
     */
    private function rotateUnusedCodes(int $examId, int $studentId): int
    {
        $now = now();

        return ExamAccess::where('exam_id', $examId)
            ->where('student_id', $studentId)
            ->where(function ($q) {
                $q->where('used', false)->orWhereNull('used');
            })
            ->where(function ($q) {
                $q->whereNull('status')
                    ->orWhere('status', 'NEW')
                    ->orWhere('status', '');
            })
            ->update([
                'status' => 'VOID',
                'used' => true,
                'used_at' => $now,
                'expires_at' => $now,
                'updated_at' => $now,
            ]);
    }

    /**
     * One-time safety normalizer for legacy rows:
     * keep only latest NEW/unused code per exam+student and void the rest.
     */
    private function normalizeLegacyUnusedCodes(): void
    {
        $rows = ExamAccess::query()
            ->where(function ($q) {
                $q->where('used', false)->orWhereNull('used');
            })
            ->where(function ($q) {
                $q->whereNull('status')
                    ->orWhere('status', 'NEW')
                    ->orWhere('status', '');
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get(['id', 'exam_id', 'student_id']);

        if ($rows->isEmpty()) {
            return;
        }

        $now = now();
        $seen = [];
        $toVoid = [];

        foreach ($rows as $row) {
            $key = ((int) $row->exam_id) . ':' . ((int) $row->student_id);
            if (!isset($seen[$key])) {
                $seen[$key] = true; // keep newest row for this pair
                continue;
            }
            $toVoid[] = (int) $row->id;
        }

        if (!empty($toVoid)) {
            ExamAccess::whereIn('id', $toVoid)->update([
                'status' => 'VOID',
                'used' => true,
                'used_at' => $now,
                'expires_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function resolveAttemptMode(?Exam $exam): string
    {
        $mode = strtolower(trim((string) SystemSetting::get('assessment_display_mode', 'auto')));
        if ($mode === 'ca_test' || $mode === 'exam') {
            return $mode;
        }

        $assessmentType = strtolower(trim((string) ($exam?->assessment_type ?? '')));
        return $assessmentType === 'ca test' ? 'ca_test' : 'exam';
    }

    private function applyAttemptModeScope($query, string $mode): void
    {
        if ($mode === 'ca_test') {
            $query->where('assessment_mode', 'ca_test');
            return;
        }

        // Backward compatibility: treat null assessment_mode as exam mode.
        $query->where(function ($q) {
            $q->where('assessment_mode', 'exam')
                ->orWhereNull('assessment_mode');
        });
    }
}
