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
use App\Http\Controllers\Api\RoleScopeController;
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
use App\Http\Controllers\Api\MarkingController;
use App\Http\Controllers\Api\CbtOfflineController;

// Public routes - Health check (lenient throttle for reachability checks)
Route::get('/health', function () {
    $dbOk = true;
    try {
        \DB::connection()->getPdo();
    } catch (\Throwable $e) {
        $dbOk = false;
    }

    return response()->json([
        'status' => $dbOk ? 'ok' : 'degraded',
        'api' => true,
        'db' => $dbOk,
        'time' => time(),
    ]);
})->middleware('throttle:120,1');

// Sample CSV for question import (public for easy access)
Route::get('/cbt/sample-csv', [CbtQuestionImportController::class, 'sampleCsv']);

// Dedicated CBT runtime endpoints (public, session-token protected per request)
Route::prefix('cbt')->middleware('throttle:120,1')->group(function () {
    Route::get('/config', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'config']);
    Route::get('/exams', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'exams']);
    Route::get('/offline-students', [CbtOfflineController::class, 'offlineStudents']);
    Route::get('/offline-exams', [CbtOfflineController::class, 'offlineExams']);
    Route::post('/exams/{examId}/verify', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'verify'])->middleware('throttle:30,1');
    Route::post('/attempts/{attemptId}/start', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'start'])->middleware('throttle:30,1');
    Route::get('/attempts/{attemptId}/state', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'state']);
    Route::get('/attempts/{attemptId}/questions', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'questions']);
    Route::post('/attempts/{attemptId}/answer', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'answer'])->middleware('throttle:120,1');
    Route::post('/attempts/{attemptId}/event', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'event'])->middleware('throttle:240,1');
    Route::post('/attempts/{attemptId}/submit', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'submit']);
    Route::post('/attempts/{attemptId}/ping', [\App\Http\Controllers\Api\CbtInterfaceController::class, 'ping'])->middleware('throttle:240,1');
});

// Auth & Verification
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/auth/email/verification-notification', [AuthController::class, 'sendVerification']);
Route::get('/auth/verify-email/{id}', [AuthController::class, 'verifyEmail']);
Route::post('/auth/password/forgot', [AuthController::class, 'sendPasswordResetLink'])->middleware('throttle:10,1');
Route::post('/auth/password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:20,1');

// OTP password reset (public)
Route::post('/auth/password/otp/request', [AuthController::class, 'requestPasswordOtp'])->middleware('throttle:10,1');
Route::post('/auth/password/otp/verify', [AuthController::class, 'resetPasswordWithOtp'])->middleware('throttle:20,1');

// Student exam access verification (public endpoint for login)
Route::post('/exam-access/verify', [ExamAccessController::class, 'verify'])->middleware('throttle:30,1');

// Admin signup applicant (public) - creates applicant account for Main Admin approval/role assignment
Route::post('/admin/signup', [UserController::class, 'store'])->middleware('throttle:10,1');

// Current student profile (auth required)
Route::middleware('auth:sanctum')->get('/student/me', [StudentController::class, 'getCurrentProfile']);
Route::middleware('auth:sanctum')->post('/student/complete-registration', [StudentController::class, 'completeRegistration']);

// Students
Route::prefix('students')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [StudentController::class, 'index']);
        Route::get('/by-reg-number', [StudentController::class, 'getByRegistrationNumber']);
        Route::get('/by-reg-number/{regNumber}', [StudentController::class, 'getByRegistrationNumber']);
        Route::get('/{id}', [StudentController::class, 'show']);
        Route::get('/{id}/exams', [StudentController::class, 'getExams']);
        Route::get('/{id}/results', [StudentController::class, 'getResults']);
        Route::get('/{id}/statistics', [StudentController::class, 'getStatistics']);
        Route::get('/export', [StudentBulkController::class, 'exportCsv']);
        Route::get('/import/template', [StudentBulkController::class, 'downloadTemplate']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::put('/{id}', [StudentController::class, 'update']);
        Route::delete('/{id}', [StudentController::class, 'destroy']);

        // Bulk operations
        Route::post('/import', [StudentBulkController::class, 'importCsv'])->middleware('throttle:10,1');
    });

    // Public student registration endpoint
    Route::post('/', [StudentController::class, 'store'])->middleware('throttle:30,1');
});

// Exams
Route::prefix('exams')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [ExamController::class, 'index']);
        Route::get('/{id}', [ExamController::class, 'show']);

        // PHASE 1: Access control check
        Route::get('/{id}/check-access', [ExamController::class, 'checkAccess']);

        Route::get('/{id}/questions', [ExamController::class, 'getQuestions']);
        Route::get('/{id}/statistics', [ExamController::class, 'getStatistics']);

        // Question randomization and selection (read-only)
        Route::get('/{id}/randomization/preview', [ExamQuestionRandomizationController::class, 'previewSelection']);
        Route::get('/{id}/randomization/stats', [ExamQuestionRandomizationController::class, 'getRandomizationStats']);
        Route::get('/{id}/randomization/selection', [ExamQuestionRandomizationController::class, 'getStudentSelection']);

        // Offline exam support
        Route::get('/{id}/download', [OfflineExamController::class, 'downloadExam']);
        Route::get('/{id}/package', [OfflineExamController::class, 'package']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [ExamController::class, 'store']);
        Route::put('/{id}', [ExamController::class, 'update']);
        Route::delete('/{id}', [ExamController::class, 'destroy']);

        // PHASE 8: Results visibility control
        Route::post('/{id}/toggle-results', [ExamController::class, 'toggleResultsVisibility']);

        // Duplicate exam
        Route::post('/{id}/duplicate', [ExamDuplicationController::class, 'duplicate']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        // Question randomization and selection (write actions)
        Route::put('/{id}/randomization', [ExamQuestionRandomizationController::class, 'updateRandomizationSettings']);
        Route::post('/{id}/randomization/lock', [ExamQuestionRandomizationController::class, 'lockQuestions']);
        Route::post('/{id}/randomization/unlock', [ExamQuestionRandomizationController::class, 'unlockQuestions']);
    });

    Route::middleware(['auth:sanctum', 'role:Student|Admin|Main Admin|Teacher'])->group(function () {
        Route::post('/{id}/start', [ExamController::class, 'startExam']);
        Route::post('/{id}/submit', [ExamController::class, 'submitExam']);
    });
});

// Offline sync endpoints (cloud and LAN)
Route::post('/sync/attempt', [OfflineExamController::class, 'syncAttempt'])->middleware('throttle:120,1');
Route::post('/local-sync/attempt', [OfflineExamController::class, 'syncAttempt'])->middleware('throttle:120,1');
Route::post('/sync/access-codes', [CbtOfflineController::class, 'syncAccessCodes'])->middleware('throttle:120,1');
Route::post('/sync/code-usage', [CbtOfflineController::class, 'syncCodeUsage'])->middleware('throttle:120,1');

// Questions
Route::prefix('questions')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [QuestionController::class, 'index']);
        Route::get('/{id}', [QuestionController::class, 'show']);
        Route::get('/types/all', [QuestionController::class, 'getQuestionTypes']);
        Route::get('/template/download', [QuestionController::class, 'downloadTemplate']);
        Route::get('/export/csv', [QuestionController::class, 'exportQuestions']);
        Route::get('/{id}/preview', [QuestionController::class, 'preview']);
        Route::get('/statistics/exam/{examId}', [QuestionController::class, 'getExamStatistics']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [QuestionController::class, 'store']);
        Route::put('/{id}', [QuestionController::class, 'update']);
        Route::delete('/{id}', [QuestionController::class, 'destroy']);

        // PHASE 3: Bulk operations
        Route::post('/bulk-delete', [QuestionController::class, 'bulkDestroy']);
        Route::post('/bulk-status', [QuestionController::class, 'bulkUpdateStatus']);

        // PHASE 3: CSV operations with support for all 14 types
        Route::post('/bulk', [QuestionController::class, 'bulkCreate']);
        Route::post('/import', [QuestionController::class, 'importQuestions']);

        // PHASE 5: Admin Actions
        Route::post('/{id}/duplicate', [QuestionController::class, 'duplicate']);
        Route::patch('/{id}/toggle-status', [QuestionController::class, 'toggleStatus']);
        Route::post('/reorder', [QuestionController::class, 'reorderQuestions']);
        Route::post('/group/by/{examId}', [QuestionController::class, 'groupQuestions']);
    });
});

// PHASE 7: Question Tags
Route::prefix('question-tags')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [QuestionTagController::class, 'index']);
        Route::get('/popular', [QuestionTagController::class, 'popular']);
        Route::get('/category/{category}', [QuestionTagController::class, 'byCategory']);
        Route::get('/{id}/questions', [QuestionTagController::class, 'getQuestions']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [QuestionTagController::class, 'store']);
        Route::put('/{id}', [QuestionTagController::class, 'update']);
        Route::delete('/{id}', [QuestionTagController::class, 'destroy']);
        Route::post('/questions/{questionId}/attach', [QuestionTagController::class, 'attachToQuestion']);
        Route::delete('/questions/{questionId}/tags/{tagId}', [QuestionTagController::class, 'detachFromQuestion']);
    });
});

// PHASE 7: Question Pools
Route::prefix('exams/{examId}/pools')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [QuestionPoolController::class, 'index']);
        Route::get('/active', [QuestionPoolController::class, 'active']);
        Route::get('/{poolId}/stats', [QuestionPoolController::class, 'stats']);
    });

    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [QuestionPoolController::class, 'store']);
        Route::put('/{poolId}', [QuestionPoolController::class, 'update']);
        Route::delete('/{poolId}', [QuestionPoolController::class, 'destroy']);
        Route::post('/{poolId}/draw', [QuestionPoolController::class, 'draw']);
        Route::post('/{poolId}/assign', [QuestionPoolController::class, 'assignQuestions']);
        Route::post('/{poolId}/remove', [QuestionPoolController::class, 'removeQuestions']);
    });
});

// Subjects
Route::prefix('subjects')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [SubjectController::class, 'index']);
        Route::get('/{id}', [SubjectController::class, 'show']);
    });
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [SubjectController::class, 'store']);
        Route::put('/{id}', [SubjectController::class, 'update']);
        Route::delete('/{id}', [SubjectController::class, 'destroy']);
        Route::post('/bulk-delete', [SubjectController::class, 'bulkDelete']);
        Route::post('/bulk-upload', [SubjectController::class, 'bulkUpload']);
    });
    Route::middleware(['auth:sanctum', 'role:Student|Admin|Main Admin|Teacher'])->group(function () {
        Route::post('/for-student', [SubjectController::class, 'getSubjectsForStudent']);
        Route::post('/student/save', [SubjectController::class, 'saveStudentSubjects']);
    });
});

// Departments
Route::prefix('departments')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [DepartmentController::class, 'index']);
        Route::get('/{id}', [DepartmentController::class, 'show']);
    });
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [DepartmentController::class, 'store']);
        Route::put('/{id}', [DepartmentController::class, 'update']);
        Route::delete('/{id}', [DepartmentController::class, 'destroy']);
        Route::post('/bulk-delete', [DepartmentController::class, 'bulkDelete']);
        Route::post('/bulk-upload', [DepartmentController::class, 'bulkUpload']);
    });
});

// Classes - Public-safe read endpoints
Route::prefix('public/classes')->group(function () {
    Route::get('/', [ClassController::class, 'publicIndex']);
    Route::get('/{id}', [ClassController::class, 'publicShow']);
});

// Classes - Scoped staff endpoints
Route::prefix('staff/classes')
    ->middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])
    ->group(function () {
        Route::get('/', [ClassController::class, 'index']);
        Route::get('/{id}', [ClassController::class, 'show']);
    });

Route::prefix('staff/classes')
    ->middleware(['auth:sanctum', 'role:Admin|Main Admin', 'teacher.scope.approved'])
    ->group(function () {
        Route::post('/', [ClassController::class, 'store']);
        Route::put('/{id}', [ClassController::class, 'update']);
        Route::delete('/{id}', [ClassController::class, 'destroy']);
        Route::post('/bulk-delete', [ClassController::class, 'bulkDelete']);
        Route::post('/bulk-upload', [ClassController::class, 'bulkUpload']);
    });

// Teachers
Route::middleware('auth:sanctum')->get('/teachers', [\App\Http\Controllers\Api\UserController::class, 'getTeachers']);

// Results
Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->prefix('results')->group(function () {
    Route::get('/student/{studentId}', [ResultController::class, 'getStudentResults']);
    Route::get('/exam/{examId}', [ResultController::class, 'getExamResults']);
    Route::get('/analytics', [ResultController::class, 'getAnalytics']);
});

Route::middleware(['auth:sanctum', 'role:Student'])->prefix('results')->group(function () {
    Route::get('/me', [ResultController::class, 'getMyResults']);
});

Route::middleware(['auth:sanctum', 'role:Student|Admin|Main Admin|Teacher'])->prefix('results')->group(function () {
    Route::get('/attempt/{attemptId}', [ResultController::class, 'getAttemptDetails']);
});

// Analytics
Route::prefix('analytics')->group(function () {
    Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/admin/dashboard', [AnalyticsController::class, 'getAdminDashboardStats']);
        Route::get('/performance', [AnalyticsController::class, 'getPerformanceMetrics']);
        Route::post('/exam/comparison', [AnalyticsController::class, 'getExamComparison']);
        Route::get('/department/performance', [AnalyticsController::class, 'getDepartmentPerformance']);
    });
    Route::middleware(['auth:sanctum', 'role:Student|Admin|Main Admin|Teacher'])->group(function () {
        Route::get('/student/{studentId}/dashboard', [AnalyticsController::class, 'getStudentDashboardStats']);
    });
});

// Reports
Route::middleware(['auth:sanctum', 'role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->prefix('reports')->group(function () {
    Route::get('/exam/{examId}/pdf', [ReportController::class, 'downloadExamReportPdf']);
    Route::get('/exam/{examId}/excel', [ReportController::class, 'downloadExamReportExcel']);
    Route::get('/term/{session}/term/{term}/class/{classId}/pdf', [ReportController::class, 'downloadTermAggregatePdf']);
    Route::get('/term/{session}/term/{term}/class/{classId}/excel', [ReportController::class, 'downloadTermAggregateExcel']);
    Route::get('/student/{studentId}/pdf', [ReportController::class, 'downloadStudentResultsPdf']);
    Route::get('/student/{studentId}/excel', [ReportController::class, 'downloadStudentResultsExcel']);
});

Route::middleware(['auth:sanctum', 'role:Student'])->prefix('reports')->group(function () {
    Route::get('/me/pdf', [ReportController::class, 'downloadMyResultsPdf']);
    Route::get('/me/excel', [ReportController::class, 'downloadMyResultsExcel']);
});

Route::middleware(['auth:sanctum', 'role:Student|Admin|Main Admin|Teacher'])->prefix('reports')->group(function () {
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
    Route::get('/teacher/scope-status', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getTeacherScopeStatus']);
    Route::get('/teacher/assignment', [\App\Http\Controllers\Api\UserPreferenceController::class, 'getTeacherAssignment']);
    Route::post('/teacher/scope-requests', [\App\Http\Controllers\Api\UserPreferenceController::class, 'saveTeacherSubjects']);
    Route::delete('/teacher/scope-requests/pending', [\App\Http\Controllers\Api\UserPreferenceController::class, 'cancelPendingTeacherRequest']);
    
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
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->get('/cbt/offline-users', [CbtOfflineController::class, 'offlineUsers']);
    Route::middleware(['role:Admin|Main Admin|Teacher'])->get('/admin/me/pages', [PagePermissionController::class, 'myPages']);

    // User management (Main Admin only - enforced by middleware in controller)
    Route::middleware('role:Admin|Main Admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::get('/roles', [RoleController::class, 'listRoles']);
        Route::post('/roles/assign/{userId}', [RoleController::class, 'assignRole']);
    });

    // Role & page permissions management (Admin/Main Admin) - with generous throttle
    Route::middleware(['role:Admin|Main Admin', 'throttle:600,1'])->group(function () {
        Route::get('/admin/roles', [RoleManagementController::class, 'listRoles']);
        Route::get('/admin/users', [RoleManagementController::class, 'listUsers']);
        Route::post('/admin/users/{userId}/roles', [RoleManagementController::class, 'assignRole']);
        Route::delete('/admin/users/{userId}/roles/{roleName}', [RoleManagementController::class, 'removeRole']);
        Route::get('/admin/pages', [PagePermissionController::class, 'index']);
        Route::get('/admin/pages/role-map', [PagePermissionController::class, 'rolePageMap']);
        Route::get('/admin/roles/modules-matrix', [PagePermissionController::class, 'roleModulesMatrix']);
        Route::post('/admin/pages/sync', [PagePermissionController::class, 'syncPages']);
        Route::post('/admin/roles/{roleId}/pages', [PagePermissionController::class, 'assignToRole']);
        Route::post('/admin/roles/modules', [PagePermissionController::class, 'updateRoleModules']);

        Route::middleware('main.admin')->group(function () {
            Route::post('/admin/roles', [RoleManagementController::class, 'createRole']);
            Route::put('/admin/roles/{roleId}', [RoleManagementController::class, 'updateRole']);
            Route::delete('/admin/roles/{roleId}', [RoleManagementController::class, 'deleteRole']);
            Route::post('/admin/roles/sync-defaults', [RoleManagementController::class, 'syncDefaults']);
            Route::get('/admin/role-scopes', [RoleScopeController::class, 'index']);
            Route::post('/admin/role-scopes', [RoleScopeController::class, 'store']);
            Route::put('/admin/role-scopes/{id}', [RoleScopeController::class, 'update']);
            Route::delete('/admin/role-scopes/{id}', [RoleScopeController::class, 'destroy']);
            Route::post('/admin/role-scopes/{id}/approve', [RoleScopeController::class, 'approve']);
            Route::post('/admin/role-scopes/{id}/reject', [RoleScopeController::class, 'reject']);
            Route::get('/admin/teacher-scope-requests', [RoleScopeController::class, 'pendingTeacherRequests']);
            Route::post('/admin/teacher-scope-requests/{batchId}/approve', [RoleScopeController::class, 'approveTeacherRequestBatch']);
            Route::post('/admin/teacher-scope-requests/{batchId}/reject', [RoleScopeController::class, 'rejectTeacherRequestBatch']);
        });
    });
    // Import questions to a subject
    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->post('/cbt/subjects/{subject}/questions/import', [CbtQuestionImportController::class, 'upload']);

    // Start exam for a subject
    Route::middleware(['role:Student|Admin|Main Admin|Teacher'])->post('/cbt/subjects/{subject}/exam/start', [CbtExamController::class, 'start']);

    // Save an answer (auto-save)
    Route::middleware(['role:Student|Admin|Main Admin|Teacher'])->post('/cbt/exams/{exam}/questions/{question}/answer', [CbtExamController::class, 'saveAnswer']);

    // Submit exam
    Route::middleware(['role:Student|Admin|Main Admin|Teacher'])->post('/cbt/exams/{exam}/submit', [CbtExamController::class, 'submit']);
    // Manual grade long-answer
    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->post('/cbt/exams/{exam}/questions/{question}/grade', [CbtExamController::class, 'manualGrade']);
    // Result breakdown
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->get('/cbt/exams/{exam}/results', [CbtExamController::class, 'resultBreakdown']);
    // Subject summary / results management (staff only)
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/cbt/results/subject/{subject}', [CbtResultsController::class, 'subjectSummary']);
        Route::get('/cbt/results', [CbtResultsController::class, 'allResults']);
        // CBT Results analytics and report cards (avoid overlap with Api\ResultController /results/analytics)
        Route::get('/cbt/results/analytics', [CbtResultsController::class, 'analytics']);
        Route::get('/results/report-cards', [CbtResultsController::class, 'reportCards']);
    });
    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->post('/results/email/{student}', [CbtResultsController::class, 'emailStudentReport']);
    // CBT Subjects management
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->get('/cbt/subjects', [CbtSubjectController::class, 'index']);
    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->post('/cbt/subjects', [CbtSubjectController::class, 'store']);
    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->post('/cbt/subjects/assign-teacher', [CbtSubjectController::class, 'assignTeacher']);
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->get('/cbt/teachers/{teacher}/subjects', [CbtSubjectController::class, 'teacherSubjects']);
    Route::middleware(['role:Admin|Main Admin'])->post('/cbt/teachers/self-assign', [CbtSubjectController::class, 'selfAssignSubjects']);

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
        Route::prefix('questions')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
            Route::get('/', [BankQuestionController::class, 'index']);
            Route::get('/stats', [BankQuestionController::class, 'stats']);
            Route::get('/export', [BankQuestionController::class, 'export']);
            Route::get('/{id}', [BankQuestionController::class, 'show']);
            Route::get('/{id}/versions', [BankQuestionController::class, 'versions']);
            Route::get('/{id}/versions/compare', [BankQuestionController::class, 'compareVersions']);
        });

        Route::prefix('questions')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
            Route::post('/import', [BankQuestionController::class, 'import']);
            Route::post('/', [BankQuestionController::class, 'store']);
            Route::post('/{id}/duplicate', [BankQuestionController::class, 'duplicate']);
            Route::post('/{id}/archive', [BankQuestionController::class, 'archive']);
            Route::post('/{id}/submit-for-review', [BankQuestionController::class, 'submitForReview']);
            Route::post('/{id}/approve', [BankQuestionController::class, 'approve']);
            Route::post('/{id}/versions/{version}/revert', [BankQuestionController::class, 'revertVersion']);
            Route::put('/{id}', [BankQuestionController::class, 'update']);
            Route::delete('/{id}', [BankQuestionController::class, 'destroy']);
            Route::post('/bulk-status', [BankQuestionController::class, 'bulkStatus']);
            Route::post('/bulk-delete', [BankQuestionController::class, 'bulkDelete']);
        });

        Route::prefix('tags')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
            Route::get('/', [BankQuestionController::class, 'tagsIndex']);
        });

        Route::prefix('tags')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
            Route::post('/', [BankQuestionController::class, 'tagsStore']);
            Route::put('/{id}', [BankQuestionController::class, 'tagsUpdate']);
            Route::delete('/{id}', [BankQuestionController::class, 'tagsDestroy']);
        });
    });

    // Exam ↔ Question linking
    Route::prefix('exams/{exam}/questions')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        // Use a distinct listing endpoint to avoid conflict with ExamController@getQuestions
        Route::get('/assigned', [ExamQuestionController::class, 'index']);
    });

    Route::prefix('exams/{exam}/questions')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
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
    Route::prefix('halls')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [HallController::class, 'index']);
        Route::get('/stats', [HallController::class, 'stats']);
        Route::get('/{id}', [HallController::class, 'show']);
        Route::get('/{id}/grid-layout', [HallController::class, 'getGridLayout']);
    });

    Route::prefix('halls')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/', [HallController::class, 'store']);
        Route::put('/{id}', [HallController::class, 'update']);
        Route::delete('/{id}', [HallController::class, 'destroy']);
        Route::post('/{id}/assign-teachers', [HallController::class, 'assignTeachers']);
    });

    // Allocation Management
    Route::prefix('allocations')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/exam/{examId}', [AllocationController::class, 'index']);
        Route::get('/run/{id}', [AllocationController::class, 'show']);
        Route::get('/student/{examId}/{studentId}', [AllocationController::class, 'getStudentAllocation']);
        Route::get('/export/pdf/{runId}', [AllocationController::class, 'exportPDF']);
        Route::get('/export/excel/{runId}', [AllocationController::class, 'exportExcel']);
        Route::get('/conflicts/{runId}', [AllocationController::class, 'getConflicts']);
        Route::get('/status/{runId}', [AllocationController::class, 'checkStatus']);
    });

    Route::prefix('allocations')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/generate', [AllocationController::class, 'generate']);
        Route::post('/regenerate/{id}', [AllocationController::class, 'regenerate']);
        Route::post('/reassign', [AllocationController::class, 'reassignStudent']);
    });
    
    // Exam Access Management (One-Time Passwords)
    Route::prefix('admin')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/exams/today', [ExamAccessController::class, 'getTodayExams']);
        Route::get('/exam-access', [ExamAccessController::class, 'index']);
    });

    Route::prefix('admin')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
        Route::post('/exam-access/generate', [ExamAccessController::class, 'generate']);
        Route::delete('/exam-access/{id}', [ExamAccessController::class, 'destroy']);
    });

    // Admin/Teacher marking workflow
    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->prefix('marking')->group(function () {
        Route::get('/exams', [MarkingController::class, 'exams']);
        Route::get('/exams/{examId}/attempts', [MarkingController::class, 'attempts']);
        Route::get('/attempts/{attemptId}', [MarkingController::class, 'attempt']);
    });

    Route::middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->prefix('marking')->group(function () {
        Route::post('/attempts/{attemptId}/questions/{questionId}/score', [MarkingController::class, 'scoreQuestion']);
        Route::post('/attempts/{attemptId}/bulk-score', [MarkingController::class, 'bulkScore']);
        Route::post('/attempts/{attemptId}/finalize', [MarkingController::class, 'finalize']);
    });

    Route::middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->prefix('marking')->group(function () {
        Route::post('/attempts/{attemptId}/force-submit', [MarkingController::class, 'forceSubmit']);
        Route::post('/attempts/{attemptId}/extend-time', [MarkingController::class, 'extendTime']);
        Route::delete('/attempts/{attemptId}', [MarkingController::class, 'clearAttempt']);
    });

    Route::middleware('role:Admin|Main Admin')->prefix('exams')->group(function () {
        Route::post('/{id}/lock', [ExamController::class, 'lockExam']);
        Route::post('/{id}/unlock', [ExamController::class, 'unlockExam']);
    });
    
    // Announcements Management (Admin)
    Route::prefix('admin/announcements')->middleware(['role:Admin|Main Admin|Teacher', 'teacher.scope.approved'])->group(function () {
        Route::get('/', [AnnouncementController::class, 'adminIndex']); // Get all for admin management
    });

    Route::prefix('admin/announcements')->middleware(['role:Admin|Main Admin', 'teacher.scope.approved'])->group(function () {
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
