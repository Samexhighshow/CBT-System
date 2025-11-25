<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\RegistrationWindow;

class EnsureRegistrationOpen
{
    public function handle(Request $request, Closure $next)
    {
        $now = now();
        $open = RegistrationWindow::where('start_at', '<=', $now)->where('end_at', '>=', $now)->first();
        if (!$open) {
            return response()->json(['message' => 'Registration is currently closed'], 403);
        }
        return $next($request);
    }
}
