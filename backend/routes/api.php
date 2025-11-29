<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\ExamController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\ResultController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\AuthController;

// Public routes
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Auth & Verification
// Email verification & reset link
Route::post('/auth/email/verification-notification', [AuthController::class, 'sendVerification']);
Route::get('/auth/verify-email/{id}', [AuthController::class, 'verifyEmail']);
Route::post('/auth/password/forgot', [AuthController::class, 'sendPasswordResetLink']);
Route::post('/auth/password/reset', [AuthController::class, 'resetPassword']);

// OTP password reset (public)
Route::post('/auth/password/otp/request', [AuthController::class, 'requestPasswordOtp']);
Route::post('/auth/password/otp/verify', [AuthController::class, 'resetPasswordWithOtp']);

// Admin signup applicant (public)
Route::post('/admin/signup', [UserController::class, 'store']);
// Students
Route::prefix('students')->group(function () {
    Route::get('/', [StudentController::class, 'index']);
    Route::get('/{id}', [StudentController::class, 'show']);
    Route::post('/', [StudentController::class, 'store']);
    Route::put('/{id}', [StudentController::class, 'update']);
    Route::delete('/{id}', [StudentController::class, 'destroy']);
    Route::get('/{id}/exams', [StudentController::class, 'getExams']);
    Route::get('/{id}/results', [StudentController::class, 'getResults']);
    Route::get('/{id}/statistics', [StudentController::class, 'getStatistics']);
});

// Exams
Route::prefix('exams')->group(function () {
    Route::get('/', [ExamController::class, 'index']);
    Route::get('/{id}', [ExamController::class, 'show']);
    Route::post('/', [ExamController::class, 'store']);
    Route::put('/{id}', [ExamController::class, 'update']);
    Route::delete('/{id}', [ExamController::class, 'destroy']);
    Route::post('/{id}/start', [ExamController::class, 'startExam']);
    Route::post('/{id}/submit', [ExamController::class, 'submitExam']);
    Route::get('/{id}/questions', [ExamController::class, 'getQuestions']);
    Route::get('/{id}/statistics', [ExamController::class, 'getStatistics']);
});

// Questions
Route::prefix('questions')->group(function () {
    Route::get('/', [QuestionController::class, 'index']);
    Route::get('/{id}', [QuestionController::class, 'show']);
    Route::post('/', [QuestionController::class, 'store']);
    Route::put('/{id}', [QuestionController::class, 'update']);
    Route::delete('/{id}', [QuestionController::class, 'destroy']);
    Route::post('/bulk', [QuestionController::class, 'bulkCreate']);
    Route::post('/import', [QuestionController::class, 'importQuestions']);
    Route::get('/template/download', [QuestionController::class, 'downloadTemplate']);
    Route::get('/export/csv', [QuestionController::class, 'exportQuestions']);
});

// Subjects
Route::prefix('subjects')->group(function () {
    Route::get('/', [SubjectController::class, 'index']);
    Route::get('/{id}', [SubjectController::class, 'show']);
    Route::post('/', [SubjectController::class, 'store']);
    Route::put('/{id}', [SubjectController::class, 'update']);
    Route::delete('/{id}', [SubjectController::class, 'destroy']);
});

// Departments
Route::prefix('departments')->group(function () {
    Route::get('/', [DepartmentController::class, 'index']);
    Route::get('/{id}', [DepartmentController::class, 'show']);
    Route::post('/', [DepartmentController::class, 'store']);
    Route::put('/{id}', [DepartmentController::class, 'update']);
    Route::delete('/{id}', [DepartmentController::class, 'destroy']);
});

// Results
Route::prefix('results')->group(function () {
    Route::get('/student/{studentId}', [ResultController::class, 'getStudentResults']);
    Route::get('/exam/{examId}', [ResultController::class, 'getExamResults']);
    Route::get('/analytics', [ResultController::class, 'getAnalytics']);
    Route::get('/attempt/{attemptId}', [ResultController::class, 'getAttemptDetails']);
});

// Analytics
Route::prefix('analytics')->group(function () {
    Route::get('/admin/dashboard', [AnalyticsController::class, 'getAdminDashboardStats']);
    Route::get('/student/{studentId}/dashboard', [AnalyticsController::class, 'getStudentDashboardStats']);
    Route::get('/performance', [AnalyticsController::class, 'getPerformanceMetrics']);
    Route::post('/exam/comparison', [AnalyticsController::class, 'getExamComparison']);
    Route::get('/department/performance', [AnalyticsController::class, 'getDepartmentPerformance']);
});

// Reports
Route::prefix('reports')->group(function () {
    Route::get('/exam/{examId}/pdf', [ReportController::class, 'downloadExamReportPdf']);
    Route::get('/exam/{examId}/excel', [ReportController::class, 'downloadExamReportExcel']);
    Route::get('/student/{studentId}/pdf', [ReportController::class, 'downloadStudentResultsPdf']);
    Route::get('/student/{studentId}/excel', [ReportController::class, 'downloadStudentResultsExcel']);
    Route::get('/attempt/{attemptId}/pdf', [ReportController::class, 'downloadAttemptReportPdf']);
});

// Restricted Main Admin operations
Route::middleware(['auth:sanctum','main.admin'])->group(function () {
    Route::post('/roles/assign/{userId}', [RoleController::class, 'assignRole']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/roles', [RoleController::class, 'listRoles']);
});
