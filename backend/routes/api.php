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
use App\Http\Controllers\Api\RoleManagementController;
use App\Http\Controllers\Api\PagePermissionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\ProfileController;
// Phase 7 Controllers
use App\Http\Controllers\Api\QuestionTagController;
use App\Http\Controllers\Api\QuestionPoolController;
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
use App\Http\Controllers\Api\ExamQuestionRandomizationController;
use App\Http\Controllers\Api\BankQuestionController;
use App\Http\Controllers\Api\ExamQuestionController;
use App\Http\Controllers\Api\ExamAccessController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\CbtInterfaceController;
use App\Http\Controllers\Api\MarkingController;
use App\Http\Controllers\Api\CbtOfflineController;

// Public routes
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Sample CSV for question import (public for easy access)
Route::get('/cbt/sample-csv', [CbtQuestionImportController::class, 'sampleCsv']);

// Dedicated CBT runtime endpoints (public, session-token protected per request)
Route::prefix('cbt')->group(function () {
    Route::get('/exams', [CbtInterfaceController::class, 'exams']);
    Route::get('/offline-students', [CbtOfflineController::class, 'offlineStudents']);
    Route::get('/offline-exams', [CbtOfflineController::class, 'offlineExams']);
    Route::post('/exams/{examId}/verify', [CbtInterfaceController::class, 'verify'])->middleware('throttle:30,1');
    Route::post('/attempts/{attemptId}/start', [CbtInterfaceController::class, 'start'])->middleware('throttle:30,1');
    Route::get('/attempts/{attemptId}/state', [CbtInterfaceController::class, 'state']);
    Route::get('/attempts/{attemptId}/questions', [CbtInterfaceController::class, 'questions']);
    Route::post('/attempts/{attemptId}/answer', [CbtInterfaceController::class, 'answer'])->middleware('throttle:120,1');
    Route::post('/attempts/{attemptId}/event', [CbtInterfaceController::class, 'event'])->middleware('throttle:240,1');
    Route::post('/attempts/{attemptId}/submit', [CbtInterfaceController::class, 'submit']);
    Route::post('/attempts/{attemptId}/ping', [CbtInterfaceController::class, 'ping'])->middleware('throttle:240,1');
});

// Auth & Verification
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/email/verification-notification', [AuthController::class, 'sendVerification']);
Route::get('/auth/verify-email/{id}', [AuthController::class, 'verifyEmail']);
Route::post('/auth/password/forgot', [AuthController::class, 'sendPasswordResetLink']);
Route::post('/auth/password/reset', [AuthController::class, 'resetPassword']);

// OTP password reset (public)
Route::post('/auth/password/otp/request', [AuthController::class, 'requestPasswordOtp']);
Route::post('/auth/password/otp/verify', [AuthController::class, 'resetPasswordWithOtp']);

// Student exam access verification (public endpoint for login)
Route::post('/exam-access/verify', [ExamAccessController::class, 'verify']);

// Admin signup applicant (public) - DISABLED: Users should only be created via registration portal or manual setup
// Route::post('/admin/signup', [UserController::class, 'store']);

// Current student profile (auth required)
Route::middleware('auth:sanctum')->get('/student/me', [StudentController::class, 'getCurrentProfile']);

// Students
Route::prefix('students')->group(function () {
    Route::get('/', [StudentController::class, 'index']);
    Route::get('/by-reg-number', [StudentController::class, 'getByRegistrationNumber']);
    Route::get('/by-reg-number/{regNumber}', [StudentController::class, 'getByRegistrationNumber']);
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

    // PHASE 1: Access control check
    Route::get('/{id}/check-access', [ExamController::class, 'checkAccess']);

    // PHASE 8: Results visibility control
    Route::post('/{id}/toggle-results', [ExamController::class, 'toggleResultsVisibility']);

    Route::post('/{id}/start', [ExamController::class, 'startExam']);
    Route::post('/{id}/submit', [ExamController::class, 'submitExam']);
    Route::get('/{id}/questions', [ExamController::class, 'getQuestions']);
    Route::get('/{id}/statistics', [ExamController::class, 'getStatistics']);

    // Duplicate exam
    Route::post('/{id}/duplicate', [ExamDuplicationController::class, 'duplicate']);

    // Question randomization and selection
    Route::put('/{id}/randomization', [ExamQuestionRandomizationController::class, 'updateRandomizationSettings']);
    Route::get('/{id}/randomization/preview', [ExamQuestionRandomizationController::class, 'previewSelection']);
    Route::post('/{id}/randomization/lock', [ExamQuestionRandomizationController::class, 'lockQuestions']);
    Route::post('/{id}/randomization/unlock', [ExamQuestionRandomizationController::class, 'unlockQuestions']);
    Route::get('/{id}/randomization/stats', [ExamQuestionRandomizationController::class, 'getRandomizationStats']);
    Route::get('/{id}/randomization/selection', [ExamQuestionRandomizationController::class, 'getStudentSelection']);

    // Offline exam support
    Route::get('/{id}/download', [OfflineExamController::class, 'downloadExam']);
    Route::get('/{id}/package', [OfflineExamController::class, 'package']);
});

// Offline sync endpoints (cloud and LAN)
Route::post('/sync/attempt', [OfflineExamController::class, 'syncAttempt']);
Route::post('/local-sync/attempt', [OfflineExamController::class, 'syncAttempt']);
Route::post('/sync/access-codes', [CbtOfflineController::class, 'syncAccessCodes']);
Route::post('/sync/code-usage', [CbtOfflineController::class, 'syncCodeUsage']);

// Questions
Route::prefix('questions')->group(function () {
    Route::get('/', [QuestionController::class, 'index']);
    Route::get('/{id}', [QuestionController::class, 'show']);
    Route::post('/', [QuestionController::class, 'store']);
    Route::put('/{id}', [QuestionController::class, 'update']);
    Route::delete('/{id}', [QuestionController::class, 'destroy']);

    // PHASE 3: Bulk operations
    Route::post('/bulk-delete', [QuestionController::class, 'bulkDestroy']);
    Route::post('/bulk-status', [QuestionController::class, 'bulkUpdateStatus']);
    Route::get('/types/all', [QuestionController::class, 'getQuestionTypes']);

    // PHASE 3: CSV operations with support for all 14 types
    Route::post('/bulk', [QuestionController::class, 'bulkCreate']);
    Route::post('/import', [QuestionController::class, 'importQuestions']);
    Route::get('/template/download', [QuestionController::class, 'downloadTemplate']);
    Route::get('/export/csv', [QuestionController::class, 'exportQuestions']);

    // PHASE 5: Admin Actions
    Route::post('/{id}/duplicate', [QuestionController::class, 'duplicate']);
    Route::patch('/{id}/toggle-status', [QuestionController::class, 'toggleStatus']);
    Route::get('/{id}/preview', [QuestionController::class, 'preview']);
    Route::post('/reorder', [QuestionController::class, 'reorderQuestions']);
    Route::get('/statistics/exam/{examId}', [QuestionController::class, 'getExamStatistics']);
    Route::post('/group/by/{examId}', [QuestionController::class, 'groupQuestions']);
});

// PHASE 7: Question Tags
Route::prefix('question-tags')->group(function () {
    Route::get('/', [QuestionTagController::class, 'index']);
    Route::get('/popular', [QuestionTagController::class, 'popular']);
    Route::get('/category/{category}', [QuestionTagController::class, 'byCategory']);
    Route::post('/', [QuestionTagController::class, 'store']);
    Route::put('/{id}', [QuestionTagController::class, 'update']);
    Route::delete('/{id}', [QuestionTagController::class, 'destroy']);
    Route::get('/{id}/questions', [QuestionTagController::class, 'getQuestions']);
    Route::post('/questions/{questionId}/attach', [QuestionTagController::class, 'attachToQuestion']);
    Route::delete('/questions/{questionId}/tags/{tagId}', [QuestionTagController::class, 'detachFromQuestion']);
});

// PHASE 7: Question Pools
Route::prefix('exams/{examId}/pools')->group(function () {
    Route::get('/', [QuestionPoolController::class, 'index']);
    Route::get('/active', [QuestionPoolController::class, 'active']);
    Route::post('/', [QuestionPoolController::class, 'store']);
    Route::put('/{poolId}', [QuestionPoolController::class, 'update']);
    Route::delete('/{poolId}', [QuestionPoolController::class, 'destroy']);
    Route::get('/{poolId}/stats', [QuestionPoolController::class, 'stats']);
    Route::post('/{poolId}/draw', [QuestionPoolController::class, 'draw']);
    Route::post('/{poolId}/assign', [QuestionPoolController::class, 'assignQuestions']);
    Route::post('/{poolId}/remove', [QuestionPoolController::class, 'removeQuestions']);
});

// Subjects
Route::prefix('subjects')->group(function () {
    Route::get('/', [SubjectController::class, 'index']);
    Route::get('/{id}', [SubjectController::class, 'show']);
    Route::post('/', [SubjectController::class, 'store']);
    Route::put('/{id}', [SubjectController::class, 'update']);
    Route::delete('/{id}', [SubjectController::class, 'destroy']);
    Route::post('/bulk-delete', [SubjectController::class, 'bulkDelete']);
    Route::post('/bulk-upload', [SubjectController::class, 'bulkUpload']);
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
    Route::post('/bulk-upload', [DepartmentController::class, 'bulkUpload']);
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
        Route::post('/bulk-upload', [\App\Http\Controllers\Api\ClassController::class, 'bulkUpload']);
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
    Route::put('/settings/bulk', [\App\Http\Controllers\Api\SystemSettingController::class, 'bulkUpdate']);
    Route::put('/settings/{key}', [\App\Http\Controllers\Api\SystemSettingController::class, 'update']);
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

// User Preferences (Subject/Class Selection)
Route::middleware('auth:sanctum')->prefix('preferences')->group(function () {
    Route::get('/options', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getOptions']);
    
    // Teacher preferences
    Route::get('/teacher/subjects', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getTeacherSubjects']);
    Route::post('/teacher/subjects', [\App\Http\Controllers\Api\UserPreferenceController::class, 'saveTeacherSubjects']);
    
    // Student preferences
    Route::get('/student/subjects', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getStudentSubjects']);
    Route::post('/student/subjects', [\App\Http\Controllers\Api\UserPreferenceController::class, 'saveStudentSubjects']);
    Route::put('/student/class-department', [\App\Http\Controllers\Api\UserPreferenceController::class, 'updateStudentClassDepartment']);
    
    // Get subjects by class
    Route::get('/subjects/class/{classId}', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getSubjectsByClass']);
});

// CBT System routes (authenticated)
Route::middleware('auth:sanctum')->group(function () {
    // Authenticated student profile snapshot
    Route::get('/student/me', [StudentController::class, 'getCurrentProfile']);

    // Supervisor offline login sync source (requires authenticated admin/teacher session)
    Route::middleware('role:Admin|Main Admin|Teacher')->get('/cbt/offline-users', [CbtOfflineController::class, 'offlineUsers']);

    // User management (Main Admin only - enforced by middleware in controller)
    Route::middleware('role:Admin|Main Admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/roles', [RoleController::class, 'listRoles']);
        Route::post('/roles/assign/{userId}', [RoleController::class, 'assignRole']);
    });

    // Role & page permissions management (Admin/Main Admin)
    Route::middleware('role:Admin|Main Admin')->group(function () {
        Route::get('/admin/roles', [RoleManagementController::class, 'listRoles']);
        Route::get('/admin/users', [RoleManagementController::class, 'listUsers']);
        Route::post('/admin/users/{userId}/roles', [RoleManagementController::class, 'assignRole']);
        Route::get('/admin/pages', [PagePermissionController::class, 'index']);
        Route::get('/admin/pages/role-map', [PagePermissionController::class, 'rolePageMap']);
        Route::post('/admin/pages/sync', [PagePermissionController::class, 'syncPages']);
        Route::post('/admin/roles/{roleId}/pages', [PagePermissionController::class, 'assignToRole']);
        Route::post('/admin/roles/modules', [PagePermissionController::class, 'updateRoleModules']);

        Route::middleware('main.admin')->group(function () {
            Route::post('/admin/roles', [RoleManagementController::class, 'createRole']);
            Route::put('/admin/roles/{roleId}', [RoleManagementController::class, 'updateRole']);
            Route::delete('/admin/roles/{roleId}', [RoleManagementController::class, 'deleteRole']);
            Route::post('/admin/roles/sync-defaults', [RoleManagementController::class, 'syncDefaults']);
        });
    });
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
    // Results analytics and report cards
    Route::get('/results/analytics', [CbtResultsController::class, 'analytics']);
    Route::get('/results/report-cards', [CbtResultsController::class, 'reportCards']);
    Route::post('/results/email/{student}', [CbtResultsController::class, 'emailStudentReport']);
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

    // Question Bank (independent from exams)
    Route::prefix('bank')->group(function () {
        Route::prefix('questions')->group(function () {
            Route::get('/', [BankQuestionController::class, 'index']);
            Route::get('/stats', [BankQuestionController::class, 'stats']);
            Route::get('/export', [BankQuestionController::class, 'export']);
            Route::post('/import', [BankQuestionController::class, 'import']);
            Route::get('/{id}', [BankQuestionController::class, 'show']);
            Route::post('/', [BankQuestionController::class, 'store']);
            Route::post('/{id}/duplicate', [BankQuestionController::class, 'duplicate']);
            Route::post('/{id}/archive', [BankQuestionController::class, 'archive']);
            Route::post('/{id}/submit-for-review', [BankQuestionController::class, 'submitForReview']);
            Route::post('/{id}/approve', [BankQuestionController::class, 'approve']);
            Route::get('/{id}/versions', [BankQuestionController::class, 'versions']);
            Route::get('/{id}/versions/compare', [BankQuestionController::class, 'compareVersions']);
            Route::post('/{id}/versions/{version}/revert', [BankQuestionController::class, 'revertVersion']);
            Route::put('/{id}', [BankQuestionController::class, 'update']);
            Route::delete('/{id}', [BankQuestionController::class, 'destroy']);
            Route::post('/bulk-status', [BankQuestionController::class, 'bulkStatus']);
            Route::post('/bulk-delete', [BankQuestionController::class, 'bulkDelete']);
        });

        Route::prefix('tags')->group(function () {
            Route::get('/', [BankQuestionController::class, 'tagsIndex']);
            Route::post('/', [BankQuestionController::class, 'tagsStore']);
            Route::put('/{id}', [BankQuestionController::class, 'tagsUpdate']);
            Route::delete('/{id}', [BankQuestionController::class, 'tagsDestroy']);
        });
    });

    // Exam ↔ Question linking
    Route::prefix('exams/{exam}/questions')->group(function () {
        // Use a distinct listing endpoint to avoid conflict with ExamController@getQuestions
        Route::get('/assigned', [ExamQuestionController::class, 'index']);
        Route::post('/', [ExamQuestionController::class, 'store']); // bulk add
        Route::post('/reorder', [ExamQuestionController::class, 'reorder']);
        Route::patch('/{question}', [ExamQuestionController::class, 'update']);
        Route::delete('/{question}', [ExamQuestionController::class, 'destroy']);
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

    // Admin marking workflow
    Route::middleware('role:Admin|Main Admin')->prefix('marking')->group(function () {
        Route::get('/exams', [MarkingController::class, 'exams']);
        Route::get('/exams/{examId}/attempts', [MarkingController::class, 'attempts']);
        Route::get('/attempts/{attemptId}', [MarkingController::class, 'attempt']);
        Route::post('/attempts/{attemptId}/questions/{questionId}/score', [MarkingController::class, 'scoreQuestion']);
        Route::post('/attempts/{attemptId}/finalize', [MarkingController::class, 'finalize']);
        Route::delete('/attempts/{attemptId}', [MarkingController::class, 'clearAttempt']);
    });
    
    // Announcements Management (Admin)
    Route::prefix('admin/announcements')->group(function () {
        Route::get('/', [AnnouncementController::class, 'adminIndex']); // Get all for admin management
        Route::post('/', [AnnouncementController::class, 'store']); // Create new
        Route::put('/{id}', [AnnouncementController::class, 'update']); // Update
        Route::delete('/{id}', [AnnouncementController::class, 'destroy']); // Delete
    });
    
    // Announcements (Public - for students to view)
    Route::prefix('announcements')->group(function () {
        Route::get('/', [AnnouncementController::class, 'index']); // Get all published
        Route::get('/{id}', [AnnouncementController::class, 'show']); // Get specific announcement
    });
});
