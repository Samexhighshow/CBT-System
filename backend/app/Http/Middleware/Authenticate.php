<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // API requests should receive a JSON 401 instead of a redirect attempt.
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }

        // This backend is API-first and may not define a web login route.
        return route('login');
    }
}
