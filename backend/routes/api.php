<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\ExamController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\ClassController;
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
use App\Http\Controllers\Api\StudentBulkController;
use App\Http\Controllers\Api\ExamDuplicationController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\OfflineExamController;
use App\Http\Controllers\StudentImportController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\Api\HallController;
use App\Http\Controllers\Api\AllocationController;
use App\Http\Controllers\Api\ExamAccessController;

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
    
    // Bulk operations
    Route::post('/import', [StudentBulkController::class, 'importCsv']);
    Route::get('/export', [StudentBulkController::class, 'exportCsv']);
    Route::get('/import/template', [StudentBulkController::class, 'downloadTemplate']);
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
    
    // Duplicate exam
    Route::post('/{id}/duplicate', [ExamDuplicationController::class, 'duplicate']);
    
    // Offline exam support
    Route::get('/{id}/download', [OfflineExamController::class, 'downloadExam']);
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
    Route::post('/bulk-delete', [SubjectController::class, 'bulkDelete']);
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
    Route::post('/bulk-delete', [DepartmentController::class, 'bulkDelete']);
});

// Classes - Public endpoints for student registration
Route::prefix('classes')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\ClassController::class, 'index']);
    Route::get('/{id}', [\App\Http\Controllers\Api\ClassController::class, 'show']);
    
    // Protected endpoints
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/', [\App\Http\Controllers\Api\ClassController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\Api\ClassController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Api\ClassController::class, 'destroy']);
        Route::post('/bulk-delete', [\App\Http\Controllers\Api\ClassController::class, 'bulkDelete']);
    });
});

// Teachers
Route::middleware('auth:sanctum')->get('/teachers', [\App\Http\Controllers\Api\UserController::class, 'getTeachers']);

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

// Public theme update endpoint for testing (place before wildcard route)
Route::put('/settings/theme', [\App\Http\Controllers\Api\SystemSettingController::class, 'updateTheme']);

// Restricted Main Admin operations
Route::middleware(['auth:sanctum', 'main.admin'])->group(function () {
    Route::get('/settings', [\App\Http\Controllers\Api\SystemSettingController::class, 'index']);
    Route::put('/settings/{key}', [\App\Http\Controllers\Api\SystemSettingController::class, 'update']);
    Route::put('/settings/bulk', [\App\Http\Controllers\Api\SystemSettingController::class, 'bulkUpdate']);
});

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
    // User management (Main Admin only - enforced by middleware in controller)
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/roles', [RoleController::class, 'listRoles']);
    Route::post('/roles/assign/{userId}', [RoleController::class, 'assignRole']);
    
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
    
    // Activity Logs (Admin only)
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::get('/activity-logs/stats', [ActivityLogController::class, 'stats']);
    Route::delete('/activity-logs/cleanup', [ActivityLogController::class, 'cleanup']);
    
    // Offline exam sync
    Route::post('/offline/sync', [OfflineExamController::class, 'syncSubmission']);
    Route::post('/offline/batch-sync', [OfflineExamController::class, 'batchSync']);
    Route::post('/offline/check-status', [OfflineExamController::class, 'checkSyncStatus']);
    
    // Backup management (Admin only)
    Route::middleware('role:admin')->prefix('backups')->group(function () {
        Route::post('/trigger', [BackupController::class, 'triggerBackup']);
        Route::get('/list', [BackupController::class, 'listBackups']);
        Route::post('/clean', [BackupController::class, 'cleanBackups']);
    });
    
    // Two-Factor Authentication with recovery codes
    Route::post('/two-factor/setup', [ProfileController::class, 'setupGoogle2FA']);
    Route::post('/two-factor/verify', [ProfileController::class, 'verifyGoogle2FA']);
    Route::post('/two-factor/recovery-codes', [ProfileController::class, 'generateRecoveryCodes']);
    
    // Hall Management
    Route::prefix('halls')->group(function () {
        Route::get('/', [HallController::class, 'index']);
        Route::get('/stats', [HallController::class, 'stats']);
        Route::get('/{id}', [HallController::class, 'show']);
        Route::post('/', [HallController::class, 'store']);
        Route::put('/{id}', [HallController::class, 'update']);
        Route::delete('/{id}', [HallController::class, 'destroy']);
        Route::post('/{id}/assign-teachers', [HallController::class, 'assignTeachers']);
        Route::get('/{id}/grid-layout', [HallController::class, 'getGridLayout']);
    });
    
    // Allocation Management
    Route::prefix('allocations')->group(function () {
        Route::get('/exam/{examId}', [AllocationController::class, 'index']);
        Route::get('/run/{id}', [AllocationController::class, 'show']);
        Route::post('/generate', [AllocationController::class, 'generate']);
        Route::post('/regenerate/{id}', [AllocationController::class, 'regenerate']);
        Route::get('/student/{examId}/{studentId}', [AllocationController::class, 'getStudentAllocation']);
        Route::post('/reassign', [AllocationController::class, 'reassignStudent']);
        Route::get('/export/pdf/{runId}', [AllocationController::class, 'exportPDF']);
        Route::get('/export/excel/{runId}', [AllocationController::class, 'exportExcel']);
        Route::get('/conflicts/{runId}', [AllocationController::class, 'getConflicts']);
        Route::get('/status/{runId}', [AllocationController::class, 'checkStatus']);
    });
    
    // Exam Access Management (One-Time Passwords)
    Route::prefix('admin')->group(function () {
        Route::get('/exams/today', [ExamAccessController::class, 'getTodayExams']);
        Route::get('/exam-access', [ExamAccessController::class, 'index']);
        Route::post('/exam-access/generate', [ExamAccessController::class, 'generate']);
        Route::delete('/exam-access/{id}', [ExamAccessController::class, 'destroy']);
    });
    
    // Student exam access verification (public endpoint for login)
    Route::post('/exam-access/verify', [ExamAccessController::class, 'verify']);
});
