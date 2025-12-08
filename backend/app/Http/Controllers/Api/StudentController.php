<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
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

            $students = $query->orderBy('created_at', 'desc')->get();

        return response()->json($students);
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

        $validated = $request->validate([
            'registration_number' => 'nullable|string|unique:students,registration_number',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'other_names' => 'nullable|string|max:255',
            'email' => 'required|email|unique:students,email',
            'password' => 'required|string|min:8|confirmed',
            'phone_number' => 'nullable|string|max:20',
            'date_of_birth' => 'required|date',
            'gender' => 'required|in:male,female',
            'class_id' => 'required|exists:classes,id',
            'department_id' => 'nullable|exists:departments,id',
            'address' => 'nullable|string',
            'guardian_first_name' => 'required|string|max:255',
            'guardian_last_name' => 'required|string|max:255',
            'guardian_relationship' => 'required|string|max:255',
            'guardian_phone' => 'required|string|max:20',
            'guardian_gender' => 'required|in:male,female',
        ]);

        // Get class details to determine class_level
        $class = \App\Models\SchoolClass::find($validated['class_id']);
        if (!$class) {
            return response()->json([
                'message' => 'Invalid class selected.'
            ], 422);
        }

        // Set class_level based on class name
        $className = $class->name;
        $classLevel = $this->getClassLevel($className);

        $validated['class_level'] = $classLevel;

        // Auto-generate registration number if not provided
        if (empty($validated['registration_number'])) {
            $autoGenerate = SystemSetting::get('registration_number_auto_generate', 'true');
            if (filter_var($autoGenerate, FILTER_VALIDATE_BOOLEAN)) {
                $validated['registration_number'] = \App\Services\RegistrationNumberService::generateRegistrationNumber();
            }
        }

        $validated['password'] = Hash::make($validated['password']);
        $student = Student::create($validated);

        // Send registration email with registration number
        // TODO: Implement email notification with Mailable

        return response()->json([
            'message' => 'Student registered successfully',
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

        // Send registration email with registration number
        // TODO: Implement email notification with Mailable

        return response()->json([
            'message' => 'Student registered successfully',
            'registration_number' => $student->registration_number,
            'student' => $student->load('department')
        ], 201);
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
        
        $exams = $student->department->exams()
            ->with(['subject', 'questions'])
            ->where('status', 'published')
            ->where('start_time', '<=', now())
            ->where('end_time', '>=', now())
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
        
        $totalExams = $student->examAttempts()->where('status', 'completed')->count();
        $averageScore = $student->examAttempts()
            ->where('status', 'completed')
            ->avg('score') ?? 0;
        
        $availableExams = $student->department->exams()
            ->where('status', 'published')
            ->where('start_time', '<=', now())
            ->where('end_time', '>=', now())
            ->count();

        return response()->json([
            'total_exams_taken' => $totalExams,
            'average_score' => round($averageScore, 2),
            'available_exams' => $availableExams,
            'registration_number' => $student->registration_number,
            'class_level' => $student->class_level,
            'department' => $student->department->name ?? null,
        ]);
    }
}
