<?php

namespace App\Http\Middleware;

use App\Services\RoleScopeService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTeacherScopeApproved
{
    public function __construct(private readonly RoleScopeService $roleScopeService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$user->hasRole('Teacher')) {
            return $next($request);
        }

        if ($this->roleScopeService->hasApprovedScopesForRole($user, 'teacher')) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Teacher scope approval is required before accessing this module.',
            'code' => 'TEACHER_SCOPE_PENDING',
        ], 403);
    }
}

