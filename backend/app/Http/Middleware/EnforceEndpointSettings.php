<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceEndpointSettings
{
    /**
     * Feature modules mapped to API path patterns.
     * Patterns use Request::is() format (without leading slash).
     */
    private const MODULE_PATTERNS = [
        'students' => [
            'api/students*',
            'api/student/me*',
            'api/preferences/student*',
        ],
        'exams' => [
            'api/exams*',
            'api/exam-access*',
            'api/cbt*',
            'api/offline*',
            'api/sync*',
            'api/local-sync*',
            'api/admin/exams/today',
            'api/admin/exam-access*',
        ],
        'questions' => [
            'api/questions*',
            'api/bank/questions*',
            'api/question-tags*',
            'api/exams/*/pools*',
        ],
        'academics' => [
            'api/subjects*',
            'api/departments*',
            'api/classes*',
            'api/public/classes*',
            'api/staff/classes*',
            'api/preferences/options',
            'api/preferences/subjects/class/*',
            'api/cbt/subjects*',
        ],
        'results' => [
            'api/results*',
            'api/marking*',
            'api/reports*',
            'api/analytics*',
        ],
        'announcements' => [
            'api/announcements*',
            'api/admin/announcements*',
        ],
        'allocations' => [
            'api/allocations*',
            'api/halls*',
            'api/teachers',
            'api/backups*',
        ],
        'admin_users_roles' => [
            'api/users*',
            'api/roles*',
            'api/admin/roles*',
            'api/admin/users*',
            'api/admin/pages*',
            'api/activity-logs*',
        ],
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // Settings and auth endpoints stay reachable so administrators cannot lock themselves out.
        if ($this->isAlwaysAllowed($request)) {
            return $next($request);
        }

        $toggles = $this->endpointToggles();
        if (empty($toggles)) {
            return $next($request);
        }

        foreach (self::MODULE_PATTERNS as $moduleKey => $patterns) {
            if ($this->isModuleEnabled($toggles, $moduleKey)) {
                continue;
            }

            foreach ($patterns as $pattern) {
                if ($request->is($pattern)) {
                    return $this->disabledResponse($moduleKey);
                }
            }
        }

        return $next($request);
    }

    private function isAlwaysAllowed(Request $request): bool
    {
        return $request->is('api/health')
            || $request->is('api/auth/*')
            || $request->is('api/settings')
            || $request->is('api/settings/*');
    }

    private function endpointToggles(): array
    {
        $raw = SystemSetting::get('endpoint_toggles', []);

        if (is_array($raw)) {
            return $raw;
        }

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function isModuleEnabled(array $toggles, string $moduleKey): bool
    {
        if (!array_key_exists($moduleKey, $toggles)) {
            return true;
        }

        $value = $toggles[$moduleKey];

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
                return false;
            }
        }

        return (bool) $value;
    }

    private function disabledResponse(string $moduleKey): JsonResponse
    {
        return response()->json([
            'message' => 'This endpoint is disabled by system settings.',
            'module' => $moduleKey,
            'code' => 'endpoint_disabled',
        ], 403);
    }
}
