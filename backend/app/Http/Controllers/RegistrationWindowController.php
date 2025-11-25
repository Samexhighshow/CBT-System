<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\RegistrationWindow;

class RegistrationWindowController extends Controller
{
    public function index()
    {
        $windows = RegistrationWindow::where('is_active', true)->get();
        return response()->json(['windows' => $windows]);
    }

    public function current()
    {
        $window = RegistrationWindow::where('start_at', '<=', now())
            ->where('end_at', '>=', now())
            ->where('is_active', true)
            ->first();
        return response()->json(['window' => $window]);
    }

    public function store(Request $request)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'name' => 'required',
            'start_at' => 'required|date',
            'end_at' => 'required|date|after:start_at'
        ]);

        $window = RegistrationWindow::create(array_merge($data, ['status' => 'open']));
        return response()->json(['window' => $window], 201);
    }

    public function update(Request $request, $id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $window = RegistrationWindow::findOrFail($id);
        $data = $request->validate([
            'name' => 'nullable',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date',
            'is_active' => 'boolean'
        ]);

        $window->update($data);
        return response()->json(['window' => $window]);
    }

    public function destroy($id)
    {
        if (!auth()->user()->hasRole('Admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        RegistrationWindow::findOrFail($id)->delete();
        return response()->json(['message' => 'Window deleted'], 200);
    }
}
