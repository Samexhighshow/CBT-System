<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Department;

class DepartmentController extends Controller
{
    public function index()
    {
        $departments = Department::where('is_active', true)->get();
        return response()->json(['departments' => $departments]);
    }

    public function show($id)
    {
        $dept = Department::with('subjects', 'tradeSubjects')->findOrFail($id);
        return response()->json(['department' => $dept]);
    }

    public function store(Request $request)
    {
        // Only admins
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'name' => 'required|unique:departments',
            'description' => 'nullable',
            'class_level' => 'required|in:JSS,SSS'
        ]);

        $dept = Department::create($data);
        return response()->json(['department' => $dept], 201);
    }

    public function update(Request $request, $id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $dept = Department::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|unique:departments,name,' . $id,
            'description' => 'nullable',
            'is_active' => 'boolean'
        ]);

        $dept->update($data);
        return response()->json(['department' => $dept]);
    }

    public function destroy($id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Department::findOrFail($id)->delete();
        return response()->json(['message' => 'Department deleted'], 200);
    }
}
