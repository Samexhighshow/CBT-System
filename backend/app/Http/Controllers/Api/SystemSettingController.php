<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SystemSetting;

class SystemSettingController extends Controller
{
    public function index()
    {
        return response()->json(SystemSetting::orderBy('key')->get());
    }

    public function update(Request $request, $key)
    {
        $validated = $request->validate([
            'value' => 'present',
            'type' => 'sometimes|in:string,boolean,json',
            'description' => 'sometimes|string',
        ]);

        $setting = SystemSetting::firstOrNew(['key' => $key]);
        $type = $validated['type'] ?? $setting->type ?? $this->inferType($validated['value']);
        $value = $this->normalizeValueByType($validated['value'], $type);

        $setting->type = $type;
        $setting->value = $value;

        if (array_key_exists('description', $validated)) {
            $setting->description = $validated['description'];
        } elseif (!$setting->exists) {
            $setting->description = $setting->description ?: null;
        }

        $setting->save();

        return response()->json(['message' => 'Setting updated', 'setting' => $setting]);
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'present',
            'settings.*.type' => 'sometimes|in:string,boolean,json',
            'settings.*.description' => 'sometimes|string',
        ]);

        foreach ($validated['settings'] as $data) {
            $setting = SystemSetting::firstOrNew(['key' => $data['key']]);
            $type = $data['type'] ?? $setting->type ?? $this->inferType($data['value']);

            $setting->type = $type;
            $setting->value = $this->normalizeValueByType($data['value'], $type);

            if (array_key_exists('description', $data)) {
                $setting->description = $data['description'];
            } elseif (!$setting->exists) {
                $setting->description = $setting->description ?: null;
            }

            $setting->save();
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }

    // Convenience: dedicated theme update endpoint used by frontend
    public function updateTheme(Request $request)
    {
        $validated = $request->validate([
            'value' => 'required|string',
        ]);

        $setting = SystemSetting::where('key', 'theme')->first();
        if (!$setting) {
            $setting = SystemSetting::create([
                'key' => 'theme',
                'value' => $validated['value'],
                'type' => 'string',
                'description' => 'UI theme',
            ]);
        } else {
            $setting->update(['value' => $validated['value']]);
        }

        return response()->json(['message' => 'Theme updated', 'setting' => $setting]);
    }

    private function inferType(mixed $value): string
    {
        if (is_bool($value)) {
            return 'boolean';
        }

        if (is_array($value) || is_object($value)) {
            return 'json';
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'], true)) {
                return 'boolean';
            }

            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE && (is_array($decoded) || is_object($decoded))) {
                return 'json';
            }
        }

        return 'string';
    }

    private function normalizeValueByType(mixed $value, string $type): mixed
    {
        if ($type === 'boolean') {
            if (is_string($value)) {
                $normalized = strtolower(trim($value));
                return in_array($normalized, ['true', '1', 'yes', 'on'], true);
            }

            return (bool) $value;
        }

        if ($type === 'json') {
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $decoded;
                }
            }

            return $value;
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_array($value) || is_object($value)) {
            return json_encode($value);
        }

        return (string) $value;
    }
}
