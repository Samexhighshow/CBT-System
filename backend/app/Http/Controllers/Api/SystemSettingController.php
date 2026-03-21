<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SystemSetting;

class SystemSettingController extends Controller
{
    /**
     * Settings keys that only Main Admin can change.
     */
    private const MAIN_ADMIN_ONLY_KEYS = [
        'student_registration_open',
        'allow_exam_retakes',
        'max_exam_attempts',
        'registration_number_prefix',
        'registration_number_year',
        'registration_number_separator',
        'registration_number_padding',
        'exam_window_start',
        'exam_window_end',
        'require_email_verification',
        'auto_logout_minutes',
        'cbt_tab_fencing_max_violations',
        'endpoint_toggles',
    ];

    public function registrationStatus()
    {
        $raw = SystemSetting::where('key', 'student_registration_open')->value('value');

        $isOpen = true;
        if ($raw !== null) {
            if (is_bool($raw)) {
                $isOpen = $raw;
            } elseif (is_numeric($raw)) {
                $isOpen = ((int) $raw) === 1;
            } else {
                $normalized = strtolower(trim((string) $raw));
                $isOpen = in_array($normalized, ['1', 'true', 'yes', 'on'], true);
            }
        }

        return response()->json([
            'student_registration_open' => $isOpen,
        ]);
    }

    public function index()
    {
        if ($forbidden = $this->forbiddenForNonSettingsManager(request())) {
            return $forbidden;
        }

        return response()->json(SystemSetting::orderBy('key')->get());
    }

    public function update(Request $request, $key)
    {
        if ($forbidden = $this->forbiddenForNonSettingsManager($request)) {
            return $forbidden;
        }

        if ($forbidden = $this->forbiddenForNonMainAdmin($request, [$key])) {
            return $forbidden;
        }

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
        if ($forbidden = $this->forbiddenForNonSettingsManager($request)) {
            return $forbidden;
        }

        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'present',
            'settings.*.type' => 'sometimes|in:string,boolean,json',
            'settings.*.description' => 'sometimes|string',
        ]);

        $keys = collect($validated['settings'])
            ->pluck('key')
            ->filter(fn ($key) => is_string($key) && $key !== '')
            ->values()
            ->all();

        if ($forbidden = $this->forbiddenForNonMainAdmin($request, $keys)) {
            return $forbidden;
        }

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

    private function forbiddenForNonSettingsManager(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($this->userHasAnyRoleInsensitive($user, ['Admin', 'Main Admin'])) {
            return null;
        }

        return response()->json(['message' => 'Forbidden: Admin or Main Admin only'], 403);
    }

    private function forbiddenForNonMainAdmin(Request $request, array $keys)
    {
        $user = $request->user();
        if (!$user || $this->userHasAnyRoleInsensitive($user, ['Main Admin'])) {
            return null;
        }

        $restricted = array_values(array_intersect($keys, self::MAIN_ADMIN_ONLY_KEYS));
        if (empty($restricted)) {
            return null;
        }

        return response()->json([
            'message' => 'Forbidden: Main Admin only for one or more selected settings.',
            'restricted_keys' => $restricted,
        ], 403);
    }

    private function userHasAnyRoleInsensitive($user, array $roleNames): bool
    {
        $target = array_map(fn ($name) => strtolower(trim((string) $name)), $roleNames);

        if (method_exists($user, 'roles')) {
            $roleValues = collect($user->roles ?? [])
                ->map(function ($role) {
                    return strtolower(trim((string) (is_object($role) ? ($role->name ?? '') : $role)));
                })
                ->filter()
                ->values()
                ->all();

            if (!empty(array_intersect($roleValues, $target))) {
                return true;
            }
        }

        if (method_exists($user, 'hasAnyRole')) {
            try {
                if ($user->hasAnyRole($roleNames)) {
                    return true;
                }
            } catch (\Throwable $e) {
                // Fall through to false if role package throws due naming mismatch.
            }
        }

        return false;
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
