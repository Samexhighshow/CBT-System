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
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\CbtQuestionImportController;
use App\Http\Controllers\CbtExamController;
use App\Http\Controllers\CbtResultsController;
use App\Http\Controllers\CbtSubjectController;

// Public routes
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Sample CSV for question import (public for easy access)
Route::get('/cbt/sample-csv', [CbtQuestionImportController::class, 'sampleCsv']);

// Auth & Verification
Route::post('/auth/login', [AuthController::class, 'login']);
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
    Route::post('/for-student', [SubjectController::class, 'getSubjectsForStudent']);
    Route::post('/student/save', [SubjectController::class, 'saveStudentSubjects']);
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

    // System settings
    Route::get('/settings', [SystemSettingController::class, 'index']);
    Route::put('/settings/{key}', [SystemSettingController::class, 'update']);
    Route::post('/settings/bulk', [SystemSettingController::class, 'bulkUpdate']);
});

// Dedicated theme update endpoint (matches frontend call)
Route::middleware(['auth:sanctum'])->put('/settings/theme', [SystemSettingController::class, 'updateTheme']);

// Auth logout
Route::middleware('auth:sanctum')->post('/auth/logout', [AuthController::class, 'logout']);

// Profile routes (authenticated users)
Route::middleware('auth:sanctum')->prefix('profile')->group(function () {
    Route::get('/', [ProfileController::class, 'show']);
    Route::put('/', [ProfileController::class, 'update']);
    Route::post('/picture', [ProfileController::class, 'updatePicture']);
    Route::delete('/picture', [ProfileController::class, 'removePicture']);
    Route::post('/password', [ProfileController::class, 'changePassword']);
    
    // Two-Factor Authentication
    Route::get('/2fa/status', [ProfileController::class, 'get2FAStatus']);
    Route::post('/2fa/google/setup', [ProfileController::class, 'setupGoogle2FA']);
    Route::post('/2fa/google/verify', [ProfileController::class, 'verifyGoogle2FA']);
    Route::post('/2fa/email/enable', [ProfileController::class, 'enableEmailOTP']);
    Route::post('/2fa/email/verify', [ProfileController::class, 'verifyEmailOTP']);
    Route::post('/2fa/disable', [ProfileController::class, 'disable2FA']);
});

// CBT System routes (authenticated)
Route::middleware('auth:sanctum')->group(function () {
    // Import questions to a subject
    Route::post('/cbt/subjects/{subject}/questions/import', [CbtQuestionImportController::class, 'upload']);

    // Start exam for a subject
    Route::post('/cbt/subjects/{subject}/exam/start', [CbtExamController::class, 'start']);

    // Save an answer (auto-save)
    Route::post('/cbt/exams/{exam}/questions/{question}/answer', [CbtExamController::class, 'saveAnswer']);

    // Submit exam
    Route::post('/cbt/exams/{exam}/submit', [CbtExamController::class, 'submit']);
    // Manual grade long-answer
    Route::post('/cbt/exams/{exam}/questions/{question}/grade', [CbtExamController::class, 'manualGrade']);
    // Result breakdown
    Route::get('/cbt/exams/{exam}/results', [CbtExamController::class, 'resultBreakdown']);
    // Subject summary
    Route::get('/cbt/results/subject/{subject}', [CbtResultsController::class, 'subjectSummary']);
    // All results with filters
    Route::get('/cbt/results', [CbtResultsController::class, 'allResults']);
    
    // CBT Subjects management
    Route::get('/cbt/subjects', [CbtSubjectController::class, 'index']);
    Route::post('/cbt/subjects', [CbtSubjectController::class, 'store']);
    Route::post('/cbt/subjects/assign-teacher', [CbtSubjectController::class, 'assignTeacher']);
    Route::get('/cbt/teachers/{teacher}/subjects', [CbtSubjectController::class, 'teacherSubjects']);
    Route::post('/cbt/teachers/self-assign', [CbtSubjectController::class, 'selfAssignSubjects']);
});
