<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Department;
use App\Models\User;
use App\Models\SchoolClass;
use App\Services\RegistrationNumberService;
use App\Jobs\SendStudentOnboardingEmailJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

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
        $sendCredentials = $request->boolean('send_credentials', false);

        $file = $request->file('file');
        $data = array_map('str_getcsv', file($file->getPathname()));
        
        // Remove header row
        $header = array_shift($data);
        
        $imported = 0;
        $errors = [];
        $studentRole = Role::firstOrCreate([
            'name' => 'student',
            'guard_name' => 'web',
        ]);

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

                if (empty($rowData['registration_number'])) {
                    $rowData['registration_number'] = RegistrationNumberService::generateUniqueRegistrationNumber();
                }

                $validator = Validator::make($rowData, [
                    'first_name' => 'required|string|max:255',
                    'last_name' => 'required|string|max:255',
                    'email' => 'required|email|unique:students,email|unique:users,email',
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

                $temporaryPassword = $this->generateTemporaryPassword();
                $studentId = $this->generateStudentId((string) $rowData['registration_number']);
                $classId = $this->resolveClassIdByLevel((string) $rowData['class_level']);
                $user = User::create([
                    'name' => trim(($rowData['first_name'] ?? '') . ' ' . ($rowData['last_name'] ?? '')),
                    'email' => $rowData['email'],
                    'password' => Hash::make($temporaryPassword),
                    'phone_number' => $rowData['phone'] ?? null,
                    'must_change_password' => true,
                    'onboarding_source' => 'admin_bulk_upload',
                ]);
                $user->assignRole($studentRole);
                $user->markEmailAsVerified();

                $student = Student::create([
                    'student_id' => $studentId,
                    'registration_number' => $rowData['registration_number'],
                    'first_name' => $rowData['first_name'],
                    'last_name' => $rowData['last_name'],
                    'email' => $rowData['email'],
                    'password' => Hash::make($temporaryPassword),
                    'phone' => $rowData['phone'],
                    'phone_number' => $rowData['phone'],
                    'class_level' => $rowData['class_level'],
                    'class_id' => $classId,
                    'department_id' => $rowData['department_id'],
                    'date_of_birth' => null,
                    'gender' => null,
                    'address' => null,
                    'guardian_first_name' => null,
                    'guardian_last_name' => null,
                    'guardian_relationship' => null,
                    'guardian_phone' => $rowData['guardian_phone'] ?: null,
                    'guardian_gender' => null,
                    'status' => 'active',
                    'is_active' => true,
                    'registration_completed' => false,
                    'created_via_admin' => true,
                ]);

                if ($sendCredentials && !empty($student->email)) {
                    $frontendBase = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
                    $link = $frontendBase . '/register?email=' . urlencode((string) $student->email) . '&reg=' . urlencode((string) $student->registration_number);
                    SendStudentOnboardingEmailJob::dispatch(
                        (string) $student->email,
                        trim((string) ($student->first_name . ' ' . $student->last_name)),
                        (string) $student->registration_number,
                        $temporaryPassword,
                        $link
                    )->onQueue('emails');
                }

                $imported++;
            }

            DB::commit();

            return response()->json([
                'message' => "Successfully imported {$imported} students",
                'imported' => $imported,
                'email_delivery' => $sendCredentials ? 'queued' : 'disabled',
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
        $csv = "First Name,Last Name,Email,Registration Number(optional),Class Level,Department ID,Phone,Guardian Phone\n";
        $csv .= "John,Doe,john.doe@example.com,,JSS1,1,08012345678,08087654321\n";
        $csv .= "Jane,Smith,jane.smith@example.com,,SSS2,2,08023456789,08098765432\n";

        return response($csv, 200)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="student_import_template.csv"');
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

    private function generateStudentId(string $registrationNumber): string
    {
        $candidate = strtoupper(trim($registrationNumber));
        if (!Student::where('student_id', $candidate)->exists()) {
            return $candidate;
        }

        do {
            $generated = 'STD' . now()->format('Y') . str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
        } while (Student::where('student_id', $generated)->exists());

        return $generated;
    }

    private function resolveClassIdByLevel(string $classLevel): ?int
    {
        $normalized = strtoupper(trim($classLevel));
        $aliases = ['SS1' => 'SSS1', 'SS2' => 'SSS2', 'SS3' => 'SSS3'];
        $target = $aliases[$normalized] ?? $normalized;
        $class = SchoolClass::query()
            ->whereRaw('REPLACE(UPPER(name), " ", "") = ?', [str_replace(' ', '', $target)])
            ->first();
        return $class?->id;
    }
}
