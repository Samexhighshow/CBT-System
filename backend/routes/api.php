<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\ExamSyncController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\RegistrationWindowController;
use App\Http\Controllers\ExamManagementController;
use App\Http\Controllers\ResultController;
use App\Http\Controllers\ReportExportController;

// Public auth routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [StudentController::class, 'register']);
Route::get('/registration/current-window', [RegistrationWindowController::class, 'current']);

// Public exam routes (for offline mode)
Route::get('/exams', [ExamController::class, 'index']);
Route::get('/exams/{id}', [ExamController::class, 'show']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Exam routes
    Route::post('/exams/{id}/start', [ExamController::class, 'start']);
    Route::post('/exams/attempts/sync', [ExamSyncController::class, 'sync']);

    // Student routes
    Route::get('/student/profile', [StudentController::class, 'getProfile']);
    Route::put('/student/profile', [StudentController::class, 'updateProfile']);

    // Admin routes
    Route::middleware('role:Admin|Sub-Admin')->group(function () {
        // Departments
        Route::get('/departments', [DepartmentController::class, 'index']);
        Route::get('/departments/{id}', [DepartmentController::class, 'show']);
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::put('/departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);

        // Subjects
        Route::get('/subjects', [SubjectController::class, 'index']);
        Route::get('/subjects/{id}', [SubjectController::class, 'show']);
        Route::post('/subjects', [SubjectController::class, 'store']);
        Route::put('/subjects/{id}', [SubjectController::class, 'update']);
        Route::delete('/subjects/{id}', [SubjectController::class, 'destroy']);

        // Registration windows
        Route::get('/registration-windows', [RegistrationWindowController::class, 'index']);
        Route::post('/registration-windows', [RegistrationWindowController::class, 'store']);
        Route::put('/registration-windows/{id}', [RegistrationWindowController::class, 'update']);
        Route::delete('/registration-windows/{id}', [RegistrationWindowController::class, 'destroy']);

        // Exam management
        Route::post('/exams', [ExamManagementController::class, 'store']);
        Route::put('/exams/{id}', [ExamManagementController::class, 'update']);
        Route::put('/exams/{id}/publish', [ExamManagementController::class, 'publish']);
        Route::post('/exams/{id}/questions', [ExamManagementController::class, 'addQuestion']);
        Route::delete('/exams/{id}', [ExamManagementController::class, 'destroy']);

        // Results management
        Route::post('/exams/{id}/release-results', [ResultController::class, 'releaseResults']);
        Route::get('/exams/{id}/results', [ResultController::class, 'getExamResults']);

        // Report exports
        Route::get('/export/students', [ReportExportController::class, 'exportStudentList']);
        Route::get('/export/exams', [ReportExportController::class, 'exportExamList']);
        Route::get('/export/results', [ReportExportController::class, 'exportResultsSummary']);
        Route::get('/export/departments', [ReportExportController::class, 'exportDepartmentReport']);
        Route::get('/export/analytics', [ReportExportController::class, 'exportPerformanceAnalytics']);
    });

    // Student results (accessible to all students)
    Route::get('/student/results', [ResultController::class, 'getStudentResults']);
    Route::get('/exams/{id}/results/csv', [ResultController::class, 'exportCSV']);

});
