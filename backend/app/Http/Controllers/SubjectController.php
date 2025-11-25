<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Subject;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        $classLevel = $request->query('class_level', 'JSS');
        $subjects = Subject::where('class_level', $classLevel)->where('is_active', true)->get();
        return response()->json(['subjects' => $subjects]);
    }

    public function show($id)
    {
        $subject = Subject::findOrFail($id);
        return response()->json(['subject' => $subject]);
    }

    public function store(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'name' => 'required|unique:subjects',
            'description' => 'nullable',
            'is_compulsory' => 'boolean',
            'class_level' => 'required|in:JSS,SSS'
        ]);

        $subject = Subject::create($data);
        return response()->json(['subject' => $subject], 201);
    }

    public function update(Request $request, $id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $subject = Subject::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|unique:subjects,name,' . $id,
            'description' => 'nullable',
            'is_compulsory' => 'boolean',
            'is_active' => 'boolean'
        ]);

        $subject->update($data);
        return response()->json(['subject' => $subject]);
    }

    public function destroy($id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Subject::findOrFail($id)->delete();
        return response()->json(['message' => 'Subject deleted'], 200);
    }
}
