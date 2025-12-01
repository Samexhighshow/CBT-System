<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StudentBulkController extends Controller
{
    /**
     * Import students from CSV
     */
    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:10240', // 10MB max
        ]);

        $file = $request->file('file');
        $data = array_map('str_getcsv', file($file->getPathname()));
        
        // Remove header row
        $header = array_shift($data);
        
        $imported = 0;
        $errors = [];

        DB::beginTransaction();
        try {
            foreach ($data as $index => $row) {
                // Skip empty rows
                if (empty(array_filter($row))) continue;
                
                $rowData = [
                    'first_name' => $row[0] ?? '',
                    'last_name' => $row[1] ?? '',
                    'email' => $row[2] ?? '',
                    'registration_number' => $row[3] ?? '',
                    'class_level' => $row[4] ?? '',
                    'department_id' => !empty($row[5]) ? (int)$row[5] : null,
                    'phone' => $row[6] ?? null,
                    'guardian_phone' => $row[7] ?? null,
                ];

                $validator = Validator::make($rowData, [
                    'first_name' => 'required|string|max:255',
                    'last_name' => 'required|string|max:255',
                    'email' => 'required|email|unique:students,email',
                    'registration_number' => 'required|string|unique:students,registration_number',
                    'class_level' => 'required|in:JSS1,JSS2,JSS3,SSS1,SSS2,SSS3',
                    'department_id' => 'nullable|exists:departments,id',
                ]);

                if ($validator->fails()) {
                    $errors[] = [
                        'row' => $index + 2, // +2 because of header and 0-index
                        'data' => $row,
                        'errors' => $validator->errors()->all(),
                    ];
                    continue;
                }

                Student::create($rowData);
                $imported++;
            }

            DB::commit();

            return response()->json([
                'message' => "Successfully imported {$imported} students",
                'imported' => $imported,
                'errors' => $errors,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Import failed: ' . $e->getMessage(),
                'imported' => $imported,
                'errors' => $errors,
            ], 500);
        }
    }

    /**
     * Export students to CSV
     */
    public function exportCsv(Request $request)
    {
        $query = Student::with('department');

        // Apply filters
        if ($request->has('class_level')) {
            $query->where('class_level', $request->class_level);
        }

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $students = $query->get();

        $csv = "First Name,Last Name,Email,Registration Number,Class Level,Department,Phone,Guardian Phone,Status,Created At\n";
        
        foreach ($students as $student) {
            $csv .= sprintf(
                "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
                $student->first_name,
                $student->last_name,
                $student->email,
                $student->registration_number,
                $student->class_level,
                $student->department->name ?? 'N/A',
                $student->phone ?? '',
                $student->guardian_phone ?? '',
                $student->status,
                $student->created_at->format('Y-m-d H:i:s')
            );
        }

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="students_export_' . date('Y-m-d') . '.csv"');
    }

    /**
     * Download CSV template for bulk import
     */
    public function downloadTemplate()
    {
        $csv = "First Name,Last Name,Email,Registration Number,Class Level,Department ID,Phone,Guardian Phone\n";
        $csv .= "John,Doe,john.doe@example.com,STU001,JSS1,1,08012345678,08087654321\n";
        $csv .= "Jane,Smith,jane.smith@example.com,STU002,SSS2,2,08023456789,08098765432\n";

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="student_import_template.csv"');
    }
}
