<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class BackupController extends Controller
{
    /**
     * Trigger manual backup
     */
    public function triggerBackup()
    {
        try {
            Artisan::call('backup:run');
            $output = Artisan::output();

            return response()->json([
                'message' => 'Backup completed successfully',
                'output' => $output,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Backup failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all backups
     */
    public function listBackups()
    {
        try {
            Artisan::call('backup:list');
            $output = Artisan::output();

            return response()->json([
                'backups' => $output,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to list backups: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Clean old backups
     */
    public function cleanBackups()
    {
        try {
            Artisan::call('backup:clean');
            $output = Artisan::output();

            return response()->json([
                'message' => 'Old backups cleaned successfully',
                'output' => $output,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Cleanup failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
