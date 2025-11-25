<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Exam;

class ExamController extends Controller
{
    public function index(Request $request)
    {
        $exams = Exam::where('published', true)->get();
        return response()->json(['exams' => $exams]);
    }

    public function show($id)
    {
        $exam = Exam::with(['questions.options'])->findOrFail($id);
        return response()->json(['exam' => $exam]);
    }

    public function start(Request $request, $id)
    {
        // Optional: server-side record of start time
        return response()->json(['message' => 'start recorded']);
    }
}
