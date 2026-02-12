<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAccess;
use App\Models\ExamAttempt;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ExamAccessController extends Controller
{
    /**
     * Get all exam access records.
     */
    public function index()
    {
        try {
            $accessRecords = ExamAccess::with(['exam:id,title', 'student:id,registration_number,first_name,last_name'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function (ExamAccess $access) {
                    $studentName = $access->student
                        ? trim($access->student->first_name . ' ' . $access->student->last_name)
                        : 'Unknown';

                    return [
                        'id' => $access->id,
                        'student_reg_number' => $access->student_reg_number ?? $access->student?->registration_number ?? 'N/A',
                        'student_name' => $studentName,
                        'exam_title' => $access->exam->title ?? 'Unknown Exam',
                        'access_code' => $access->access_code,
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

                $existingAccess = ExamAccess::where('exam_id', $exam->id)
                    ->where('student_id', $student->id)
                    ->where('used', false)
                    ->first();

                if ($existingAccess) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Student already has an unused access code for this exam',
                    ], 422);
                }

                $accessCode = ExamAccess::generateUniqueCode();
                $expiresAt = $this->resolveExpiryForExam($exam);

                $access = ExamAccess::create([
                    'exam_id' => $exam->id,
                    'student_id' => $student->id,
                    'student_reg_number' => $student->registration_number,
                    'access_code' => $accessCode,
                    'used' => false,
                    'expires_at' => $expiresAt,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Access code generated successfully',
                    'data' => [
                        'id' => $access->id,
                        'access_code' => $accessCode,
                        'student_name' => trim($student->first_name . ' ' . $student->last_name),
                        'student_reg_number' => $student->registration_number,
                        'exam_title' => $exam->title,
                        'generated_at' => $access->created_at,
                        'expires_at' => $expiresAt,
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

                $existingAccess = ExamAccess::where('exam_id', $exam->id)
                    ->where('student_id', $student->id)
                    ->where('used', false)
                    ->first();

                if ($existingAccess) {
                    $errors[] = "Student {$regNumber} already has an unused access code for this exam";
                    continue;
                }

                $accessCode = ExamAccess::generateUniqueCode();
                $expiresAt = $this->resolveExpiryForExam($exam);

                ExamAccess::create([
                    'exam_id' => $exam->id,
                    'student_id' => $student->id,
                    'student_reg_number' => $student->registration_number,
                    'access_code' => $accessCode,
                    'used' => false,
                    'expires_at' => $expiresAt,
                ]);

                $generated[] = [
                    'reg_number' => $student->registration_number,
                    'student_name' => trim($student->first_name . ' ' . $student->last_name),
                    'access_code' => $accessCode,
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
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid access code for this exam',
                ], 403);
            }

            if ($access->expires_at && $access->expires_at->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code has expired',
                ], 403);
            }

            $student = $access->student;

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
                    ->where(function ($q) {
                        $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
                    })
                    ->latest('id')
                    ->first();
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
     * Get today's exams for access code generation.
     */
    public function getTodayExams()
    {
        try {
            $today = Carbon::today();

            $exams = Exam::with('subject:id,name')
                ->where(function ($query) use ($today) {
                    $query->whereDate('start_datetime', $today)
                        ->orWhereDate('start_time', $today);
                })
                ->orderByRaw('COALESCE(start_datetime, start_time) asc')
                ->get()
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
                'message' => 'Failed to fetch today\'s exams',
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
}
