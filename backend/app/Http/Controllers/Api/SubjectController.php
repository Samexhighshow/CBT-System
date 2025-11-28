<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index()
    {
        $subjects = Subject::with('department')->orderBy('name')->get();
        return response()->json($subjects);
    }

    public function show($id)
    {
        $subject = Subject::with(['department', 'exams'])->findOrFail($id);
        return response()->json($subject);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:subjects,name',
            'code' => 'required|string|max:20|unique:subjects,code',
            'description' => 'nullable|string',
            'department_id' => 'required|exists:departments,id',
        ]);

        $subject = Subject::create($validated);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject->load('department')
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $subject = Subject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255|unique:subjects,name,' . $id,
            'code' => 'sometimes|string|max:20|unique:subjects,code,' . $id,
            'description' => 'nullable|string',
            'department_id' => 'sometimes|exists:departments,id',
        ]);

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->load('department')
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
}
