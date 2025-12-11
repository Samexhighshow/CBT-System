<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExamAccess;
use App\Models\Exam;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class ExamAccessController extends Controller
{
    /**
     * Get all exam access records
     */
    public function index()
    {
        try {
            $accessRecords = ExamAccess::with(['exam', 'student'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($access) {
                    return [
                        'id' => $access->id,
                        'student_reg_number' => $access->student->reg_number ?? 'N/A',
                        'student_name' => $access->student->name ?? 'Unknown',
                        'exam_title' => $access->exam->title ?? 'Unknown Exam',
                        'access_code' => $access->access_code,
                        'used' => $access->used,
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
     * Generate access codes for students
     */
    public function generate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'exam_id' => 'required|exists:exams,id',
            'reg_numbers' => 'required|array|min:1',
            'reg_numbers.*' => 'required|string',
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
            $regNumbers = $request->reg_numbers;
            $generated = [];
            $errors = [];

            foreach ($regNumbers as $regNumber) {
                // Find student by registration number
                $student = User::where('reg_number', $regNumber)
                    ->whereHas('roles', function ($query) {
                        $query->where('name', 'Student');
                    })
                    ->first();

                if (!$student) {
                    $errors[] = "Student with reg number {$regNumber} not found";
                    continue;
                }

                // Check if student already has an unused access code for this exam
                $existingAccess = ExamAccess::where('exam_id', $exam->id)
                    ->where('student_id', $student->id)
                    ->where('used', false)
                    ->first();

                if ($existingAccess) {
                    $errors[] = "Student {$regNumber} already has an unused access code for this exam";
                    continue;
                }

                // Generate access code
                $accessCode = ExamAccess::generateUniqueCode();

                // Set expiration to end of exam day
                $expiresAt = Carbon::parse($exam->date)->endOfDay();

                // Create access record
                $access = ExamAccess::create([
                    'exam_id' => $exam->id,
                    'student_id' => $student->id,
                    'access_code' => $accessCode,
                    'used' => false,
                    'expires_at' => $expiresAt,
                ]);

                $generated[] = [
                    'reg_number' => $regNumber,
                    'student_name' => $student->name,
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
     * Verify and use an access code
     */
    public function verify(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'access_code' => 'required|string',
            'exam_id' => 'required|exists:exams,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $access = ExamAccess::where('access_code', $request->access_code)
                ->where('exam_id', $request->exam_id)
                ->first();

            if (!$access) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid access code for this exam',
                ], 403);
            }

            if ($access->used) {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code has already been used',
                    'used_at' => $access->used_at,
                ], 403);
            }

            if ($access->expires_at && $access->expires_at->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This access code has expired',
                ], 403);
            }

            // Mark as used
            $access->markAsUsed();

            return response()->json([
                'success' => true,
                'message' => 'Access code verified successfully',
                'data' => [
                    'student_id' => $access->student_id,
                    'exam_id' => $access->exam_id,
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
     * Revoke an access code (delete unused code)
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
     * Get today's exams for access code generation
     */
    public function getTodayExams()
    {
        try {
            $today = Carbon::today();
            $exams = Exam::with('subject')
                ->whereDate('date', $today)
                ->orderBy('start_time')
                ->get()
                ->map(function ($exam) {
                    return [
                        'id' => $exam->id,
                        'title' => $exam->title,
                        'subject_name' => $exam->subject->name ?? 'Unknown',
                        'date' => $exam->date,
                        'start_time' => $exam->start_time,
                        'end_time' => $exam->end_time,
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
}
