<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use App\Models\SchoolClass;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        $query = Subject::query();

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Active status filter for subjects. Default to active-only unless show_all is provided.
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        } elseif (!$request->has('show_all')) {
            $query->where('is_active', true);
        }

        // Legacy class_id filter (kept for backward compatibility, but subjects now use class_level)
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        // Class level filter: subjects are stored per class_level, not per class_id
        if ($request->has('class_level')) {
            $level = $request->input('class_level');
            $query->where('class_level', $level);
        }

        // Subject type filter
        if ($request->has('subject_type')) {
            $query->where('subject_type', $request->subject_type);
        }

        // Pagination
        $perPage = $request->input('limit', 15);
        $subjects = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'data' => $subjects->items(),
            'current_page' => $subjects->currentPage(),
            'last_page' => $subjects->lastPage(),
            'per_page' => $subjects->perPage(),
            'total' => $subjects->total(),
            'next_page' => $subjects->currentPage() < $subjects->lastPage() ? $subjects->currentPage() + 1 : null,
            'prev_page' => $subjects->currentPage() > 1 ? $subjects->currentPage() - 1 : null,
        ]);
    }

    public function show($id)
    {
        $subject = Subject::findOrFail($id);
        return response()->json($subject);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:20',
            'description' => 'nullable|string',
            'class_level' => 'required|string|max:255',
            'subject_type' => 'required|in:core,elective',
            'is_compulsory' => 'boolean',
            'is_active' => 'boolean',
        ]);

        // Verify that at least one class exists for this level
        $classExists = SchoolClass::where('name', $validated['class_level'])->exists();
        
        if (!$classExists) {
            return response()->json([
                'message' => 'No classes found for the provided class level',
                'errors' => ['class_level' => ['No classes match this level']]
            ], 422);
        }

        // Check for duplicate subject at this class level
        $duplicate = Subject::where('name', $validated['name'])
            ->where('class_level', $validated['class_level'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'This subject already exists for this class level',
                'errors' => ['name' => ['Subject already exists for this class level']]
            ], 422);
        }

        $subject = Subject::create([
            'name' => $validated['name'],
            'code' => $validated['code'],
            'description' => $validated['description'] ?? null,
            'class_level' => $validated['class_level'],
            'class_id' => null,
            'department_id' => null,
            'subject_type' => $validated['subject_type'],
            'is_compulsory' => $validated['subject_type'] === 'core',
            'is_active' => array_key_exists('is_active', $validated) ? (bool)$validated['is_active'] : true,
        ]);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $subject = Subject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:20',
            'description' => 'nullable|string',
            'class_level' => 'sometimes|string|max:255',
            'subject_type' => 'sometimes|in:core,elective',
            'is_active' => 'boolean',
        ]);

        // Verify class level exists if provided
        if (array_key_exists('class_level', $validated)) {
            $classExists = SchoolClass::where('name', $validated['class_level'])->exists();
            if (!$classExists) {
                return response()->json([
                    'message' => 'No classes found for the provided class level',
                    'errors' => ['class_level' => ['No classes match this level']]
                ], 422);
            }
        }

        if (array_key_exists('subject_type', $validated)) {
            $validated['is_compulsory'] = $validated['subject_type'] === 'core';
        }

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject
        ]);
    }

    public function destroy($id)
    {
        $subject = Subject::findOrFail($id);
        $subject->delete();

        return response()->json([
            'message' => 'Subject deleted successfully'
        ]);
    }

    /**
     * Bulk delete subjects.
     */
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:subjects,id',
        ]);

        $deletedCount = Subject::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'message' => 'Subjects deleted successfully',
            'deleted_count' => $deletedCount
        ]);
    }

    /**
     * Bulk upload subjects from CSV
    * Expected columns: name,code,class_level,subject_type,description
     */
    public function bulkUpload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120'
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $content = file_get_contents($path);
        $lines = explode("\n", trim($content));

        if (count($lines) < 2) {
            return response()->json([
                'message' => 'CSV file is empty or invalid',
                'errors' => ['file' => ['CSV must contain header and at least one row']]
            ], 422);
        }

        $header = str_getcsv(array_shift($lines));
        $expectedHeaders = ['name', 'code', 'class_level', 'subject_type', 'description'];
        
        if ($header !== $expectedHeaders) {
            return response()->json([
                'message' => 'Invalid CSV header format',
                'expected' => $expectedHeaders,
                'provided' => $header,
                'errors' => ['file' => ['CSV header does not match expected format']]
            ], 422);
        }

        $inserted = 0;
        $errors = [];
        $rowNum = 2;

        foreach ($lines as $line) {
            if (empty(trim($line))) continue;

            $data = str_getcsv($line);
            
            if (count($data) !== count($expectedHeaders)) {
                $errors[] = "Row {$rowNum}: Invalid number of columns";
                $rowNum++;
                continue;
            }

            $row = array_combine($expectedHeaders, $data);
            
            try {
                // Validate required fields
                if (empty($row['name']) || empty($row['code']) || empty($row['class_level']) || empty($row['subject_type'])) {
                    $errors[] = "Row {$rowNum}: Missing required fields";
                    $rowNum++;
                    continue;
                }

                $classExists = SchoolClass::where('name', $row['class_level'])->exists();

                if (!$classExists) {
                    $errors[] = "Row {$rowNum}: No class found for level '{$row['class_level']}'";
                    $rowNum++;
                    continue;
                }

                // Validate subject_type
                if (!in_array($row['subject_type'], ['core', 'elective'])) {
                    $errors[] = "Row {$rowNum}: Invalid subject_type '{$row['subject_type']}'";
                    $rowNum++;
                    continue;
                }

                // Check for duplicate at class level
                $exists = Subject::where('name', $row['name'])
                    ->where('class_level', $row['class_level'])
                    ->exists();

                if ($exists) {
                    $errors[] = "Row {$rowNum}: Subject '{$row['name']}' already exists for {$row['class_level']}";
                    $rowNum++;
                    continue;
                }

                Subject::create([
                    'name' => $row['name'],
                    'code' => $row['code'],
                    'class_id' => null,
                    'class_level' => $row['class_level'],
                    'department_id' => null,
                    'subject_type' => $row['subject_type'],
                    'description' => $row['description'] ?? null,
                    'is_compulsory' => $row['subject_type'] === 'core'
                ]);
                $inserted++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: {$e->getMessage()}";
            }

            $rowNum++;
        }

        return response()->json([
            'message' => "Bulk upload completed. {$inserted} subjects imported.",
            'inserted' => $inserted,
            'errors' => $errors,
            'error_count' => count($errors)
        ], count($errors) > 0 && $inserted === 0 ? 422 : 200);
    }

    /**
     * Get subjects for a student based on class level and department
     */
    public function getSubjectsForStudent(Request $request)
    {
        $validated = $request->validate([
            'class_level' => 'required|in:JSS1,JSS2,JSS3,SSS1,SSS2,SSS3',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $classLevel = $validated['class_level'];
        $departmentId = $validated['department_id'] ?? null;
        $isJSS = str_starts_with($classLevel, 'JSS');

        // Query subjects
        $compulsory = Subject::where('subject_group', 'compulsory')
            ->where(function($q) use ($classLevel) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
            })
            ->get();

        $trade = Subject::where('subject_group', 'trade')
            ->where(function($q) use ($classLevel, $departmentId) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
                if ($departmentId) {
                    $q->where(function($q2) use ($departmentId) {
                        $q2->whereJsonContains('departments', $departmentId)
                           ->orWhereNull('departments');
                    });
                }
            })
            ->get();

        $elective = Subject::where('subject_group', 'elective')
            ->where(function($q) use ($classLevel, $departmentId) {
                $q->whereJsonContains('class_levels', $classLevel)
                  ->orWhereNull('class_levels');
                if ($departmentId) {
                    $q->where(function($q2) use ($departmentId) {
                        $q2->whereJsonContains('departments', $departmentId)
                           ->orWhereNull('departments');
                    });
                }
            })
            ->get();

        return response()->json([
            'compulsory' => $compulsory,
            'trade' => $trade,
            'elective' => $elective,
        ]);
    }

    /**
     * Save student subject selections
     */
    public function saveStudentSubjects(Request $request)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'subject_ids' => 'required|array',
            'subject_ids.*' => 'exists:subjects,id',
        ]);

        $student = \App\Models\Student::findOrFail($validated['student_id']);
        $student->subjects()->sync($validated['subject_ids']);

        return response()->json([
            'message' => 'Subjects saved successfully',
            'subjects' => $student->subjects
        ]);
    }
}
