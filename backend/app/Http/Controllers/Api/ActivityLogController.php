<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends Controller
{
    /**
     * Get activity logs with filters.
     */
    public function index(Request $request)
    {
        $query = ActivityLog::with(['causer', 'subject'])
            ->orderBy('created_at', 'desc');

        // Filter by log name
        if ($request->has('log_name')) {
            $query->where('log_name', $request->log_name);
        }

        // Filter by event
        if ($request->has('event')) {
            $query->where('event', $request->event);
        }

        // Filter by causer
        if ($request->has('causer_id')) {
            $query->where('causer_id', $request->causer_id);
        }

        // Filter by date range
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $perPage = $request->get('per_page', 50);
        $logs = $query->paginate($perPage);

        return response()->json($logs);
    }

    /**
     * Get activity statistics.
     */
    public function stats()
    {
        $totalActivities = ActivityLog::count();
        $todayActivities = ActivityLog::whereDate('created_at', today())->count();
        
        $topEvents = ActivityLog::select('event', DB::raw('count(*) as count'))
            ->groupBy('event')
            ->orderBy('count', 'desc')
            ->limit(10)
            ->get();

        $topUsers = ActivityLog::select('causer_id', 'causer_type', DB::raw('count(*) as count'))
            ->whereNotNull('causer_id')
            ->groupBy('causer_id', 'causer_type')
            ->orderBy('count', 'desc')
            ->limit(10)
            ->with('causer')
            ->get();

        return response()->json([
            'total_activities' => $totalActivities,
            'today_activities' => $todayActivities,
            'top_events' => $topEvents,
            'top_users' => $topUsers,
        ]);
    }

    /**
     * Delete old activity logs.
     */
    public function cleanup(Request $request)
    {
        $request->validate([
            'days' => 'required|integer|min:1',
        ]);

        $deletedCount = ActivityLog::where('created_at', '<', now()->subDays($request->days))
            ->delete();

        return response()->json([
            'message' => "Deleted {$deletedCount} activity logs older than {$request->days} days",
            'deleted_count' => $deletedCount,
        ]);
    }
}
