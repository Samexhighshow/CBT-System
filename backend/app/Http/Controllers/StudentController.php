<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Student;
use App\Models\Subject;
use App\Models\RegistrationWindow;
use Illuminate\Support\Facades\Hash;

class StudentController extends Controller
{
    public function register(Request $request)
    {
        // Check if registration window is open
        $window = RegistrationWindow::where('start_at', '<=', now())
            ->where('end_at', '>=', now())
            ->where('is_active', true)
            ->first();

        if (!$window) {
            return response()->json(['message' => 'Registration is currently closed'], 403);
        }

        $data = $request->validate([
            'first_name' => 'required',
            'last_name' => 'required',
            'email' => 'required|email|unique:students,email',
            'phone' => 'nullable',
            'class_level' => 'required|in:JSS1,JSS2,JSS3,SSS1,SSS2,SSS3',
            'department' => 'nullable|string',
            'trade_subjects' => 'nullable|array'
        ]);

        $studentId = 'S' . strtoupper(uniqid());
        $student = Student::create(array_merge($data, ['student_id' => $studentId]));

        // Auto-assign subjects based on class level and department
        $this->assignSubjectsToStudent($student);

        return response()->json(['student' => $student, 'message' => 'Registration successful'], 201);
    }

    public function getProfile(Request $request)
    {
        $student = auth()->user()->student; // Assuming a relation exists
        return response()->json(['student' => $student]);
    }

    public function updateProfile(Request $request)
    {
        $student = auth()->user()->student;
        $data = $request->validate([
            'phone' => 'nullable',
            'department' => 'nullable',
            'trade_subjects' => 'nullable|array'
        ]);

        $student->update($data);
        return response()->json(['student' => $student]);
    }

    private function assignSubjectsToStudent(Student $student)
    {
        // For JSS: assign all compulsory JSS subjects
        if (str_starts_with($student->class_level, 'JSS')) {
            $subjects = Subject::where('class_level', 'JSS')
                ->where('is_compulsory', true)
                ->pluck('id')
                ->toArray();
        } else {
            // For SSS: assign compulsory subjects for the department
            $subjects = Subject::where('class_level', 'SSS')
                ->where('is_compulsory', true)
                ->pluck('id')
                ->toArray();
        }

        // Attach subjects (many-to-many relationship - create student_subjects table)
        // $student->subjects()->attach($subjects);
    }
}
