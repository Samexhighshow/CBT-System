<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SystemSetting;

class SystemSettingController extends Controller
{
    public function index()
    {
        return response()->json(SystemSetting::all());
    }

    public function update(Request $request, $key)
    {
        $validated = $request->validate([
            'value' => 'required',
            'type' => 'sometimes|in:string,boolean,json',
            'description' => 'sometimes|string',
        ]);

        $setting = SystemSetting::where('key', $key)->firstOrFail();
        $setting->update($validated);

        return response()->json(['message' => 'Setting updated', 'setting' => $setting]);
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'required',
        ]);

        foreach ($validated['settings'] as $data) {
            $setting = SystemSetting::where('key', $data['key'])->first();
            if ($setting) {
                $setting->update(['value' => $data['value']]);
            }
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
