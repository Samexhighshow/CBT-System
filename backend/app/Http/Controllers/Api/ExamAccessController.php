<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\ExamAttempt;
use App\Models\ExamSitting;
use App\Models\Student;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            'sitting_id' => 'nullable|integer|min:1',
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
            $sitting = $this->resolveSittingForGeneration($exam, (int) $request->input('sitting_id', 0));
            if ($request->filled('sitting_id') && !$sitting) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid sitting selected for this assessment.',
                ], 422);
            }
            $generated = [];
            $errors = [];

            if ($request->has('student_id')) {
                $student = Student::findOrFail($request->student_id);
                $eligibility = $this->validateStudentExamAssignment($exam, $student);
                if (!($eligibility['eligible'] ?? false)) {
                    return response()->json([
                        'success' => false,
                        'message' => $eligibility['message'] ?? 'Student is not eligible for this exam.',
                    ], 422);
                }
                $expiresAt = $this->resolveExpiryForExam($exam, $sitting);

                [$access, $rotatedCount] = DB::transaction(function () use ($exam, $student, $expiresAt) {
                    // Serialize generation per student to avoid duplicate NEW codes from rapid double-submit.
                    Student::whereKey($student->id)->lockForUpdate()->first();

                    $rotatedCount = $this->rotateUnusedCodes(
                        $exam->id,
                        $student->id,
                        $student->registration_number
                    );
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
                        'sitting_id' => $sitting?->id,
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

                $eligibility = $this->validateStudentExamAssignment($exam, $student);
                if (!($eligibility['eligible'] ?? false)) {
                    $errors[] = "{$regNumber}: " . ($eligibility['message'] ?? 'Student is not eligible for this exam.');
                    continue;
                }
                $expiresAt = $this->resolveExpiryForExam($exam, $sitting);
                $accessCode = null;
                $rotatedCount = 0;

                DB::transaction(function () use ($exam, $student, $expiresAt, &$accessCode, &$rotatedCount) {
                    // Serialize generation per student to avoid duplicate NEW codes from rapid double-submit.
                    Student::whereKey($student->id)->lockForUpdate()->first();

                    $rotatedCount = $this->rotateUnusedCodes(
                        $exam->id,
                        $student->id,
                        $student->registration_number
                    );
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

            if ($student && $exam) {
                $eligibility = $this->validateStudentExamAssignment($exam, $student);
                if (!($eligibility['eligible'] ?? false)) {
                    return response()->json([
                        'success' => false,
                        'message' => $eligibility['message'] ?? 'Student is not eligible for this exam.',
                    ], 403);
                }
            }

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
            $strictMode = $this->strictSystemMode();

            $sittingExamIds = collect();
            $sittingRows = collect();

            if (Schema::hasTable('exam_sittings')) {
                $sittingsQuery = ExamSitting::with(['exam.subject:id,name'])
                    ->whereIn('status', ['scheduled', 'active'])
                    ->whereHas('exam', function ($query) {
                        $query->whereNotIn('status', ['cancelled']);
                    })
                    ->where(function ($query) use ($todayStart, $todayEnd) {
                        $query->where(function ($sq) use ($todayStart, $todayEnd) {
                            $sq->whereNotNull('start_at')
                                ->whereNotNull('end_at')
                                ->where('start_at', '<=', $todayEnd)
                                ->where('end_at', '>=', $todayStart);
                        })
                        ->orWhere(function ($sq) use ($todayEnd) {
                            $sq->whereNotNull('start_at')
                                ->whereNull('end_at')
                                ->where('start_at', '<=', $todayEnd);
                        })
                        ->orWhere(function ($sq) use ($todayStart) {
                            $sq->whereNull('start_at')
                                ->whereNotNull('end_at')
                                ->where('end_at', '>=', $todayStart);
                        })
                        ->orWhere(function ($sq) {
                            $sq->whereNull('start_at')
                                ->whereNull('end_at');
                        });
                    })
                    ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END")
                    ->orderBy('start_at')
                    ->orderByDesc('id');

                if ($strictMode !== null) {
                    $sittingsQuery->where('assessment_mode_snapshot', $strictMode);
                }

                $sittingRows = $sittingsQuery->get();
                $sittingExamIds = $sittingRows->pluck('exam_id')->unique()->map(fn ($id) => (int) $id);
            }

            $exams = Exam::with('subject:id,name')
                ->where('published', true)
                ->whereIn('status', ['scheduled', 'active'])
                ->when($sittingExamIds->isNotEmpty(), function ($query) use ($sittingExamIds) {
                    $query->whereNotIn('id', $sittingExamIds->all());
                })
                ->orderByRaw('COALESCE(start_datetime, start_time) asc')
                ->get()
                ->filter(function (Exam $exam) use ($strictMode) {
                    if ($strictMode === null) {
                        return true;
                    }

                    return $this->resolveAttemptMode($exam) === $strictMode;
                })
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
                        'sitting_id' => null,
                        'assessment_mode_snapshot' => $this->resolveAttemptMode($exam),
                        'title' => $exam->title,
                        'subject_name' => $exam->subject->name ?? 'Unknown',
                        'date' => optional($start)->toDateString(),
                        'start_time' => optional($start)->format('H:i'),
                        'end_time' => optional($end)->format('H:i'),
                    ];
                });

            $sittingRows = $sittingRows->map(function (ExamSitting $sitting) {
                $exam = $sitting->exam;
                if (!$exam) {
                    return null;
                }

                $start = $sitting->start_at ?? $exam->start_datetime ?? $exam->start_time;
                $end = $sitting->end_at ?? $exam->end_datetime ?? $exam->end_time;

                return [
                    'id' => $exam->id,
                    'sitting_id' => (int) $sitting->id,
                    'assessment_mode_snapshot' => (string) ($sitting->assessment_mode_snapshot ?: $this->resolveAttemptMode($exam)),
                    'title' => $exam->title,
                    'subject_name' => $exam->subject?->name ?? 'Unknown',
                    'date' => optional($start)->toDateString(),
                    'start_time' => optional($start)->format('H:i'),
                    'end_time' => optional($end)->format('H:i'),
                ];
            })->filter()->values();

            $rows = $sittingRows->concat($exams)->values();

            return response()->json([
                'success' => true,
                'data' => $rows,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available exams',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function resolveExpiryForExam(Exam $exam, ?ExamSitting $sitting = null): Carbon
    {
        $examEnd = $sitting?->end_at ?? $exam->end_datetime ?? $exam->end_time;

        if ($examEnd instanceof Carbon) {
            return $examEnd->copy();
        }

        return Carbon::today()->endOfDay();
    }

    private function strictSystemMode(): ?string
    {
        $mode = strtolower(trim((string) SystemSetting::get('assessment_display_mode', 'auto')));
        return in_array($mode, ['ca_test', 'exam'], true) ? $mode : null;
    }

    private function resolveSittingForGeneration(Exam $exam, int $requestedSittingId = 0): ?ExamSitting
    {
        if (!Schema::hasTable('exam_sittings')) {
            return null;
        }

        $strictMode = $this->strictSystemMode();

        if ($requestedSittingId > 0) {
            $query = ExamSitting::query()
                ->where('exam_id', $exam->id)
                ->where('id', $requestedSittingId);

            if ($strictMode !== null) {
                $query->where('assessment_mode_snapshot', $strictMode);
            }

            return $query->first();
        }

        return ExamSitting::resolveForExamByMode($exam, $strictMode);
    }

    /**
     * Invalidate any existing unused code for same exam/student before generating a new one.
     * This allows unlimited regeneration while ensuring only the latest code remains active.
     */
    private function rotateUnusedCodes(int $examId, int $studentId, ?string $studentRegNumber = null): int
    {
        $now = now();
        $normalizedReg = strtoupper(trim((string) $studentRegNumber));

        return ExamAccess::where('exam_id', $examId)
            ->where(function ($q) use ($studentId, $normalizedReg) {
                $q->where('student_id', $studentId);

                if ($normalizedReg !== '') {
                    // Also match legacy rows where student_id may be missing but registration number is present.
                    $q->orWhere(function ($sq) use ($normalizedReg) {
                        $sq->whereNull('student_id')
                            ->whereRaw('UPPER(COALESCE(student_reg_number, "")) = ?', [$normalizedReg]);
                    });
                }
            })
            ->where(function ($q) {
                // Void every non-final code shape (legacy/new/blank statuses and rows not marked used).
                $q->where(function ($sq) {
                    $sq->where('used', false)->orWhereNull('used');
                })->orWhere(function ($sq) {
                    $sq->whereNull('status')
                        ->orWhere('status', '')
                        ->orWhereNotIn('status', ['USED', 'VOID']);
                });
            })
            ->update([
                'status' => 'VOID',
                'active_new_token' => null,
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
                $q->where(function ($sq) {
                    $sq->where('used', false)->orWhereNull('used');
                })->orWhere(function ($sq) {
                    $sq->whereNull('status')
                        ->orWhere('status', '')
                        ->orWhereNotIn('status', ['USED', 'VOID']);
                });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get(['id', 'exam_id', 'student_id', 'student_reg_number']);

        if ($rows->isEmpty()) {
            return;
        }

        $now = now();
        $seen = [];
        $toVoid = [];

        foreach ($rows as $row) {
            $studentId = (int) ($row->student_id ?? 0);
            $reg = strtoupper(trim((string) ($row->student_reg_number ?? '')));
            $identity = $studentId > 0 ? 'sid:' . $studentId : 'reg:' . $reg;
            $key = ((int) $row->exam_id) . ':' . $identity;
            if (!isset($seen[$key])) {
                $seen[$key] = true; // keep newest row for this pair
                continue;
            }
            $toVoid[] = (int) $row->id;
        }

        if (!empty($toVoid)) {
            ExamAccess::whereIn('id', $toVoid)->update([
                'status' => 'VOID',
                'active_new_token' => null,
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

    private function validateStudentExamAssignment(Exam $exam, Student $student): array
    {
        if (!$exam->isStudentClassEligible($student)) {
            $details = $exam->classEligibilityDetails($student);
            return [
                'eligible' => false,
                'message' => sprintf(
                    'Class mismatch. Exam is for %s, student is in %s.',
                    $details['required_class'] ?? 'Unknown',
                    $details['your_class'] ?? 'Unknown'
                ),
            ];
        }

        if ($exam->subject_id) {
            $hasSubject = $student->subjects()->where('subject_id', $exam->subject_id)->exists();
            if (!$hasSubject) {
                return [
                    'eligible' => false,
                    'message' => 'Student is not assigned to this subject.',
                ];
            }
        }

        return ['eligible' => true];
    }
}
