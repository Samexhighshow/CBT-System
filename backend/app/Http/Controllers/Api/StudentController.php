<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\SystemSetting;
use App\Models\Question;
use App\Models\User;
use App\Models\SchoolClass;
use App\Mail\StudentOnboardingMail;
use App\Services\GradingService;
use App\Services\RegistrationNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class StudentController extends Controller
{
    /**
     * Get current authenticated student's profile snapshot.
     */
    public function getCurrentProfile(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Authentication required.',
            ], 401);
        }

        $student = Student::with(['department', 'schoolClass'])
            ->where('email', $user->email)
            ->first();

        if (!$student) {
            return response()->json([
                'message' => 'Student profile not found for this user account.',
            ], 404);
        }

        $completedAttempts = $student->examAttempts()->whereIn('status', ['completed', 'submitted'])->count();
        $averageScore = (float) ($student->examAttempts()->whereIn('status', ['completed', 'submitted'])->avg('score') ?? 0);

        return response()->json([
            'id' => $student->id,
            'student_id' => $student->student_id,
            'registration_number' => $student->registration_number,
            'first_name' => $student->first_name,
            'last_name' => $student->last_name,
            'other_names' => $student->other_names,
            'email' => $student->email,
            'class_id' => $student->class_id,
            'class_level' => $student->class_level,
            'department_id' => $student->department_id,
            'department' => $student->department?->name,
            'class_name' => $student->schoolClass?->name,
            'completed_attempts' => $completedAttempts,
            'average_score' => round($averageScore, 2),
        ]);
    }

    /**
     * Display a listing of students
     */
    public function index(Request $request)
    {
        $query = Student::with(['department', 'exams']);

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('registration_number', 'like', "%{$search}%")
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Department filter
        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Class level filter
        if ($request->has('class_level')) {
            $query->where('class_level', $request->class_level);
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Pagination
        $perPage = $request->input('limit', 15);
        $students = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $students->items(),
            'current_page' => $students->currentPage(),
            'last_page' => $students->lastPage(),
            'per_page' => $students->perPage(),
            'total' => $students->total(),
            'next_page' => $students->currentPage() < $students->lastPage() ? $students->currentPage() + 1 : null,
            'prev_page' => $students->currentPage() > 1 ? $students->currentPage() - 1 : null,
        ]);
    }

    /**
     * Display the specified student
     */
    public function show($id)
    {
        $student = Student::with(['department', 'exams', 'examAttempts.exam'])->findOrFail($id);
        
        return response()->json($student);
    }

    /**
     * Store a newly created student
     */
    public function store(Request $request)
    {
        // Enforce system setting: student registration toggle
        $registrationOpen = SystemSetting::get('student_registration_open', true);
        if (!$registrationOpen) {
            return response()->json([
                'message' => 'Student registration is currently closed by the administrator.'
            ], 403);
        }

        $quickRegister = $request->boolean('quick_register', false);

        $validated = $request->validate([
            'registration_number' => 'nullable|string|unique:students,registration_number',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'other_names' => 'nullable|string|max:255',
            'email' => 'required|email|unique:students,email|unique:users,email',
            'password' => $quickRegister ? 'nullable|string|min:8|confirmed' : 'required|string|min:8|confirmed',
            'phone_number' => 'nullable|string|max:20',
            'date_of_birth' => $quickRegister ? 'nullable|date' : 'required|date',
            'gender' => $quickRegister ? 'nullable|in:male,female' : 'required|in:male,female',
            'class_id' => $quickRegister ? 'nullable|exists:school_classes,id' : 'required|exists:school_classes,id',
            'class_level' => $quickRegister ? 'nullable|in:JSS1,JSS2,JSS3,SSS1,SSS2,SSS3,SS1,SS2,SS3' : 'nullable',
            'department_id' => 'nullable|exists:departments,id',
            'address' => 'nullable|string',
            'guardian_first_name' => $quickRegister ? 'nullable|string|max:255' : 'required|string|max:255',
            'guardian_last_name' => $quickRegister ? 'nullable|string|max:255' : 'required|string|max:255',
            'guardian_relationship' => $quickRegister ? 'nullable|string|max:255' : 'required|string|max:255',
            'guardian_phone' => $quickRegister ? 'nullable|string|max:20' : 'required|string|max:20',
            'guardian_gender' => $quickRegister ? 'nullable|in:male,female' : 'required|in:male,female',
        ]);

        if ($quickRegister && empty($validated['class_id']) && !empty($validated['class_level'])) {
            $validated['class_id'] = $this->resolveClassIdByLevel((string) $validated['class_level']);
        }

        // Get class details to determine class_level
        $class = !empty($validated['class_id']) ? \App\Models\SchoolClass::find($validated['class_id']) : null;
        if (!$class) {
            if (!$quickRegister) {
                return response()->json([
                    'message' => 'Invalid class selected.'
                ], 422);
            }
        }

        // Set class_level based on class name
        if ($class) {
            $className = $class->name;
            $classLevel = $this->getClassLevel($className);
            $validated['class_level'] = $classLevel;
        } else {
            $validated['class_level'] = strtoupper((string) ($validated['class_level'] ?? 'JSS1'));
        }

        // Auto-generate registration number if not provided
        if (empty($validated['registration_number'])) {
            $autoGenerate = SystemSetting::get('registration_number_auto_generate', 'true');
            if (filter_var($autoGenerate, FILTER_VALIDATE_BOOLEAN)) {
                $validated['registration_number'] = RegistrationNumberService::generateUniqueRegistrationNumber();
            }
        }
        if (empty($validated['registration_number'])) {
            $validated['registration_number'] = RegistrationNumberService::generateUniqueRegistrationNumber();
        }

        $generatedPassword = null;
        if (empty($validated['password'])) {
            $generatedPassword = $this->generateTemporaryPassword();
            $validated['password'] = $generatedPassword;
            $validated['password_confirmation'] = $generatedPassword;
        }

        if ($quickRegister) {
            $validated['date_of_birth'] = $validated['date_of_birth'] ?? now()->subYears(14)->toDateString();
            $validated['gender'] = $validated['gender'] ?? 'male';
            $validated['guardian_first_name'] = $validated['guardian_first_name'] ?? $validated['first_name'];
            $validated['guardian_last_name'] = $validated['guardian_last_name'] ?? $validated['last_name'];
            $validated['guardian_relationship'] = $validated['guardian_relationship'] ?? 'Parent';
            $validated['guardian_phone'] = $validated['guardian_phone'] ?? 'N/A';
            $validated['guardian_gender'] = $validated['guardian_gender'] ?? 'male';
            $validated['address'] = $validated['address'] ?? 'To be updated by student';
        }

        $validated['student_id'] = $this->generateStudentId($validated['registration_number'] ?? null);
        $hashedPassword = Hash::make($validated['password']);
        $validated['password'] = $hashedPassword;

        $student = DB::transaction(function () use ($validated, $hashedPassword) {
            $fullName = trim(
                ($validated['first_name'] ?? '') . ' ' .
                ($validated['last_name'] ?? '') . ' ' .
                ($validated['other_names'] ?? '')
            );

            $user = User::create([
                'name' => $fullName !== '' ? $fullName : ($validated['email'] ?? 'Student'),
                'email' => $validated['email'],
                'password' => $hashedPassword,
                'phone_number' => $validated['phone_number'] ?? null,
            ]);

            $studentRole = Role::firstOrCreate([
                'name' => 'student',
                'guard_name' => 'web',
            ]);
            $user->assignRole($studentRole);
            $user->markEmailAsVerified();

            return Student::create($validated);
        });

        if ($quickRegister && $generatedPassword) {
            try {
                $frontendBase = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
                $link = $frontendBase . '/register?email=' . urlencode((string) $student->email) . '&reg=' . urlencode((string) $student->registration_number);
                Mail::to((string) $student->email)->queue(new StudentOnboardingMail(
                    trim((string) ($student->first_name . ' ' . $student->last_name)),
                    (string) $student->registration_number,
                    $generatedPassword,
                    $link
                ));
            } catch (\Throwable $mailError) {
                \Log::warning('Student onboarding email failed', [
                    'student_id' => $student->id,
                    'email' => $student->email,
                    'error' => $mailError->getMessage(),
                ]);
            }
        }

        return response()->json([
            'message' => $quickRegister
                ? 'Student created. Registration number generated and onboarding email queued.'
                : 'Student registered successfully',
            'registration_number' => $student->registration_number,
            'student' => $student->load(['department', 'schoolClass'])
        ], 201);
    }

    /**
     * Determine class level from class name
     */
    private function getClassLevel($className): string
    {
        $name = strtoupper($className);
        
        if (strpos($name, 'JSS1') !== false || strpos($name, 'JUNIOR 1') !== false) return 'JSS1';
        if (strpos($name, 'JSS2') !== false || strpos($name, 'JUNIOR 2') !== false) return 'JSS2';
        if (strpos($name, 'JSS3') !== false || strpos($name, 'JUNIOR 3') !== false) return 'JSS3';
        if (strpos($name, 'SSS1') !== false || strpos($name, 'SS1') !== false || strpos($name, 'SENIOR 1') !== false) return 'SS1';
        if (strpos($name, 'SSS2') !== false || strpos($name, 'SS2') !== false || strpos($name, 'SENIOR 2') !== false) return 'SS2';
        if (strpos($name, 'SSS3') !== false || strpos($name, 'SS3') !== false || strpos($name, 'SENIOR 3') !== false) return 'SS3';
        
        return 'JSS1'; // Default
    }

    private function resolveClassIdByLevel(string $classLevel): ?int
    {
        $normalized = strtoupper(trim($classLevel));
        $aliases = [
            'SS1' => 'SSS1',
            'SS2' => 'SSS2',
            'SS3' => 'SSS3',
        ];
        $target = $aliases[$normalized] ?? $normalized;

        $class = SchoolClass::query()
            ->whereRaw('UPPER(name) = ?', [$target])
            ->orWhereRaw('REPLACE(UPPER(name), " ", "") = ?', [str_replace(' ', '', $target)])
            ->first();

        return $class?->id;
    }

    private function generateTemporaryPassword(int $length = 10): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        $max = strlen($alphabet) - 1;
        $chars = [];
        for ($i = 0; $i < $length; $i++) {
            $chars[] = $alphabet[random_int(0, $max)];
        }
        return implode('', $chars);
    }

    /**
     * Generate a unique legacy student_id required by the students table.
     */
    private function generateStudentId(?string $registrationNumber = null): string
    {
        if (!empty($registrationNumber)) {
            $candidate = strtoupper(trim($registrationNumber));
            $exists = Student::where('student_id', $candidate)->exists();
            if (!$exists) {
                return $candidate;
            }
        }

        do {
            $candidate = 'STD' . now()->format('Y') . str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
        } while (Student::where('student_id', $candidate)->exists());

        return $candidate;
    }

    /**
     * Update the specified student
     */
    public function update(Request $request, $id)
    {
        $student = Student::findOrFail($id);

        $validated = $request->validate([
            'registration_number' => ['sometimes', 'string', Rule::unique('students')->ignore($student->id)],
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'other_names' => 'nullable|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('students')->ignore($student->id)],
            'password' => 'sometimes|string|min:8',
            'phone_number' => 'nullable|string|max:20',
            'date_of_birth' => 'sometimes|date',
            'gender' => 'sometimes|in:male,female',
            'department_id' => 'sometimes|exists:departments,id',
            'class_level' => 'sometimes|in:JSS1,JSS2,JSS3,SS1,SS2,SS3',
            'address' => 'nullable|string',
            'status' => 'sometimes|in:active,inactive,suspended',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $student->update($validated);

        return response()->json([
            'message' => 'Student updated successfully',
            'student' => $student->load('department')
        ]);
    }

    /**
     * Remove the specified student
     */
    public function destroy($id)
    {
        $student = Student::findOrFail($id);
        $student->delete();

        return response()->json([
            'message' => 'Student deleted successfully'
        ]);
    }

    /**
     * Get student's available exams
     */
    public function getExams($id)
    {
        $student = Student::findOrFail($id);

        $now = now();

        $exams = \App\Models\Exam::with(['subject', 'schoolClass'])
            ->where('class_id', $student->class_id)
            ->where('published', true)
            ->whereIn('status', ['scheduled', 'active'])
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('start_datetime')->whereNull('start_time');
                })
                ->orWhere('start_datetime', '<=', $now)
                ->orWhere('start_time', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('end_datetime')->whereNull('end_time');
                })
                ->orWhere('end_datetime', '>=', $now)
                ->orWhere('end_time', '>=', $now);
            })
            ->orderByRaw('COALESCE(start_datetime, start_time) asc')
            ->get();

        return response()->json($exams);
    }

    /**
     * Get student's exam results
     */
    public function getResults($id)
    {
        $student = Student::findOrFail($id);
        
        $results = $student->examAttempts()
            ->with(['exam.subject'])
            ->where('status', 'completed')
            ->orderBy('completed_at', 'desc')
            ->get();

        return response()->json($results);
    }

    /**
     * Get student statistics
     */
    public function getStatistics($id)
    {
        $student = Student::findOrFail($id);

        $attempts = $student->examAttempts()
            ->whereIn('status', ['completed', 'submitted'])
            ->with('exam')
            ->get();

        $totalExams = $attempts->count();
        $averageScore = $attempts->isNotEmpty()
            ? round((float) $attempts->avg(function ($attempt) {
                $total = $this->resolveAttemptTotalMarks($attempt);
                return $total > 0 ? (((float) ($attempt->score ?? 0) / $total) * 100) : 0;
            }), 2)
            : 0;

        $passedCount = $attempts->filter(function ($attempt) {
            $total = $this->resolveAttemptTotalMarks($attempt);
            $passing = $this->resolveAttemptPassingMarks($attempt, $total);
            $score = (float) ($attempt->score ?? 0);
            return $this->hasPassed($score, $total, $passing);
        })->count();

        $passRate = $totalExams > 0 ? round(($passedCount / $totalExams) * 100, 2) : 0;

        $now = now();
        $availableExams = \App\Models\Exam::query()
            ->where('class_id', $student->class_id)
            ->where('published', true)
            ->whereIn('status', ['scheduled', 'active'])
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('start_datetime')->whereNull('start_time');
                })
                ->orWhere('start_datetime', '<=', $now)
                ->orWhere('start_time', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->where(function ($q) {
                    $q->whereNull('end_datetime')->whereNull('end_time');
                })
                ->orWhere('end_datetime', '>=', $now)
                ->orWhere('end_time', '>=', $now);
            })
            ->count();

        return response()->json([
            'total_exams_taken' => $totalExams,
            'average_score' => $averageScore,
            'pass_rate' => $passRate,
            'available_exams' => $availableExams,
            'registration_number' => $student->registration_number,
            'class_level' => $student->class_level,
            'department' => $student->department->name ?? null,
        ]);
    }

    /**
     * Get student by registration number (for exam access code generation)
     */
    public function getByRegistrationNumber(Request $request, $regNumber = null)
    {
        $resolvedRegNumber = $regNumber ?? $request->query('reg_number');
        $resolvedRegNumber = $resolvedRegNumber ? strtoupper(trim((string) $resolvedRegNumber)) : null;

        if (!$resolvedRegNumber) {
            return response()->json([
                'message' => 'Registration number is required'
            ], 422);
        }

        $student = Student::where('registration_number', $resolvedRegNumber)
            ->with(['department', 'schoolClass'])
            ->first();

        if (!$student) {
            return response()->json([
                'message' => 'Student not found with this registration number'
            ], 404);
        }

        return response()->json([
            'id' => $student->id,
            'name' => $student->first_name . ' ' . $student->last_name,
            'reg_number' => $student->registration_number,
            'email' => $student->email,
            'department' => $student->department->name ?? null,
            'class_level' => $student->class_level,
        ]);
    }

    private function resolveAttemptTotalMarks($attempt): float
    {
        if (!$attempt) {
            return 0;
        }

        $questionIds = collect($attempt->question_order ?: [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values();

        if ($questionIds->isEmpty()) {
            $questionIds = Question::where('exam_id', $attempt->exam_id)
                ->orderBy('order_index')
                ->orderBy('id')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        if ($questionIds->isEmpty()) {
            return 0;
        }

        $questions = Question::with('bankQuestion:id,marks')
            ->whereIn('id', $questionIds)
            ->get();

        return (float) $questions->sum(function (Question $question) {
            if (($question->marks_override ?? null) !== null) {
                return (float) $question->marks_override;
            }

            if (($question->marks ?? null) !== null) {
                return (float) $question->marks;
            }

            if (($question->bankQuestion?->marks ?? null) !== null) {
                return (float) $question->bankQuestion->marks;
            }

            return 1.0;
        });
    }

    private function resolveAttemptPassingMarks($attempt, ?float $totalMarks = null): ?float
    {
        $exam = $attempt->exam;
        if (!$exam) {
            return null;
        }

        $direct = $exam->passing_marks ?? null;
        if ($direct !== null && is_numeric($direct)) {
            return (float) $direct;
        }

        $metaPassing = data_get($exam->metadata, 'passing_marks');
        if ($metaPassing !== null && is_numeric($metaPassing)) {
            return (float) $metaPassing;
        }

        if ($totalMarks !== null && $totalMarks > 0) {
            $passMarkPercent = $this->gradingService()->passMarkPercentage() / 100;
            return round($totalMarks * $passMarkPercent, 2);
        }

        return null;
    }

    private function hasPassed(float $score, float $totalMarks, ?float $passingMarks = null): bool
    {
        if ($passingMarks !== null) {
            return $score >= $passingMarks;
        }

        if ($totalMarks <= 0) {
            return false;
        }

        $percentage = ($score / max(1, $totalMarks)) * 100;
        return $this->gradingService()->didPassPercentage($percentage);
    }

    private function gradingService(): GradingService
    {
        return app(GradingService::class);
    }
}
