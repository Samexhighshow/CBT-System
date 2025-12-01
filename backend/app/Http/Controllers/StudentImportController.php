<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\User;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\StudentsExport;
use App\Imports\StudentsImport;

class StudentImportController extends Controller
{
    /**
     * Download CSV template for student import
     */
    public function downloadTemplate()
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="student_import_template.csv"',
        ];

        $template = "first_name,last_name,email,registration_number,department_id,class_level,status\n";
        $template .= "John,Doe,john.doe@example.com,REG001,1,JSS1,active\n";
        $template .= "Jane,Smith,jane.smith@example.com,REG002,1,SSS2,active\n";

        return response($template, 200, $headers);
    }

    /**
     * Import students from CSV file
     */
    public function import(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:csv,txt|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Invalid file format',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $file = $request->file('file');
            $imported = 0;
            $errors = [];

            // Read CSV
            $csv = array_map('str_getcsv', file($file->getRealPath()));
            $header = array_shift($csv); // Remove header row

            foreach ($csv as $index => $row) {
                if (count($row) < 7) {
                    $errors[] = "Row " . ($index + 2) . ": Incomplete data";
                    continue;
                }

                $data = array_combine($header, $row);

                // Validate department exists
                if (!Department::find($data['department_id'])) {
                    $errors[] = "Row " . ($index + 2) . ": Invalid department ID";
                    continue;
                }

                // Check if student already exists
                if (Student::where('registration_number', $data['registration_number'])->exists()) {
                    $errors[] = "Row " . ($index + 2) . ": Registration number already exists";
                    continue;
                }

                try {
                    // Create user account
                    $user = User::create([
                        'name' => $data['first_name'] . ' ' . $data['last_name'],
                        'email' => $data['email'],
                        'password' => Hash::make('password123'), // Default password
                    ]);

                    $user->assignRole('student');

                    // Create student record
                    Student::create([
                        'user_id' => $user->id,
                        'first_name' => $data['first_name'],
                        'last_name' => $data['last_name'],
                        'registration_number' => $data['registration_number'],
                        'email' => $data['email'],
                        'department_id' => $data['department_id'],
                        'class_level' => $data['class_level'],
                        'status' => $data['status'] ?? 'active',
                    ]);

                    $imported++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                }
            }

            return response()->json([
                'message' => 'Import completed',
                'imported' => $imported,
                'errors' => $errors,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Import failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export all students to CSV
     */
    public function export()
    {
        $students = Student::with('department')->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="students_export_' . date('Y-m-d') . '.csv"',
        ];

        $csv = "ID,First Name,Last Name,Email,Registration Number,Department,Class Level,Status\n";

        foreach ($students as $student) {
            $csv .= implode(',', [
                $student->id,
                $student->first_name,
                $student->last_name,
                $student->email,
                $student->registration_number,
                $student->department->name ?? 'N/A',
                $student->class_level,
                $student->status,
            ]) . "\n";
        }

        return response($csv, 200, $headers);
    }
}
