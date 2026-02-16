import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { showSuccess, showError } from '../../utils/alerts';
import { useTheme } from '../../hooks/useTheme';

interface Setting {
  id: number;
  key: string;
  value: any;
  type: 'string' | 'boolean' | 'json';
  description?: string;
}

interface EndpointToggles {
  students: boolean;
  exams: boolean;
  questions: boolean;
  academics: boolean;
  results: boolean;
  announcements: boolean;
  allocations: boolean;
  admin_users_roles: boolean;
}

interface GradeScaleRow {
  grade: string;
  min: number;
}

interface PositionScaleRow {
  label: string;
  min: number;
}

const defaultEndpointToggles: EndpointToggles = {
  students: true,
  exams: true,
  questions: true,
  academics: true,
  results: true,
  announcements: true,
  allocations: true,
  admin_users_roles: true,
};

const fixedWaecScale: GradeScaleRow[] = [
  { grade: 'A1', min: 75 },
  { grade: 'B2', min: 70 },
  { grade: 'B3', min: 65 },
  { grade: 'C4', min: 60 },
  { grade: 'C5', min: 55 },
  { grade: 'C6', min: 50 },
  { grade: 'D7', min: 45 },
  { grade: 'E8', min: 40 },
  { grade: 'F9', min: 0 },
];

const fixedLetterScale: GradeScaleRow[] = [
  { grade: 'A', min: 70 },
  { grade: 'B', min: 60 },
  { grade: 'C', min: 50 },
  { grade: 'D', min: 45 },
  { grade: 'E', min: 40 },
  { grade: 'F', min: 0 },
];

const fixedPositionScale: PositionScaleRow[] = [
  { label: '1st', min: 70 },
  { label: '2nd', min: 60 },
  { label: '3rd', min: 50 },
  { label: 'Pass', min: 40 },
  { label: 'Fail', min: 0 },
];

const findSettingValue = (key: string, settingsList: Setting[]) =>
  settingsList.find(setting => setting.key === key)?.value;

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemName, setSystemName] = useState('');
  const [endpointToggles, setEndpointToggles] = useState<EndpointToggles>(defaultEndpointToggles);
  const [gradingScheme, setGradingScheme] = useState<'waec' | 'letter' | 'position'>('waec');
  const [waecScale, setWaecScale] = useState<GradeScaleRow[]>(fixedWaecScale);
  const [letterScale, setLetterScale] = useState<GradeScaleRow[]>(fixedLetterScale);
  const [positionScale, setPositionScale] = useState<PositionScaleRow[]>(fixedPositionScale);
  const [passMarkPercentage, setPassMarkPercentage] = useState('50');
  const { theme, changeTheme } = useTheme();
  // Token is injected via axios interceptor in `api` using `auth_token` key

  const parseJsonSetting = useCallback((value: any, fallback: any) => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value === 'object') {
      return value;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }, []);

  const clampScore = useCallback((value: any, fallback: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(100, Math.max(0, numeric));
  }, []);

  const normalizeGradeScale = useCallback((
    value: any,
    fixedRows: GradeScaleRow[],
  ): GradeScaleRow[] => {
    const parsed = parseJsonSetting(value, fixedRows);
    const entries = Array.isArray(parsed) ? parsed : fixedRows;

    const minByGrade = new Map<string, number>();
    entries.forEach((entry: any) => {
      const grade = String(entry?.grade || '').trim().toUpperCase();
      if (!grade) return;
      minByGrade.set(grade, clampScore(entry?.min, 0));
    });

    return fixedRows.map((row) => ({
      grade: row.grade,
      min: minByGrade.has(row.grade) ? clampScore(minByGrade.get(row.grade), row.min) : row.min,
    }));
  }, [clampScore, parseJsonSetting]);

  const normalizePositionScale = useCallback((
    value: any,
    fixedRows: PositionScaleRow[],
  ): PositionScaleRow[] => {
    const parsed = parseJsonSetting(value, fixedRows);
    const entries = Array.isArray(parsed) ? parsed : fixedRows;

    const minByLabel = new Map<string, number>();
    entries.forEach((entry: any) => {
      const label = String(entry?.label || '').trim().toLowerCase();
      if (!label) return;
      minByLabel.set(label, clampScore(entry?.min, 0));
    });

    return fixedRows.map((row) => ({
      label: row.label,
      min: minByLabel.has(row.label.toLowerCase())
        ? clampScore(minByLabel.get(row.label.toLowerCase()), row.min)
        : row.min,
    }));
  }, [clampScore, parseJsonSetting]);

  const updateScaleMin = (index: number, value: string, setter: React.Dispatch<React.SetStateAction<GradeScaleRow[]>>) => {
    setter((current) =>
      current.map((row, rowIndex) => (
        rowIndex === index
          ? { ...row, min: clampScore(value, row.min) }
          : row
      ))
    );
  };

  const updatePositionMin = (index: number, value: string) => {
    setPositionScale((current) =>
      current.map((row, rowIndex) => (
        rowIndex === index
          ? { ...row, min: clampScore(value, row.min) }
          : row
      ))
    );
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      
      // Load system name
      setSystemName(findSettingValue('system_name', res.data) || 'CBT System');

      const endpointValue = findSettingValue('endpoint_toggles', res.data);
      const parsedToggles = parseJsonSetting(endpointValue, defaultEndpointToggles);
      setEndpointToggles({ ...defaultEndpointToggles, ...parsedToggles });

      const scheme = String(findSettingValue('grading_scheme', res.data) || 'waec').toLowerCase();
      setGradingScheme(scheme === 'letter' ? 'letter' : scheme === 'position' ? 'position' : 'waec');

      const waecScaleValue = findSettingValue('grading_scale_waec', res.data);
      setWaecScale(normalizeGradeScale(waecScaleValue, fixedWaecScale));

      const letterScaleValue = findSettingValue('grading_scale_letter', res.data);
      setLetterScale(normalizeGradeScale(letterScaleValue, fixedLetterScale));

      const positionScaleValue = findSettingValue('position_grading_scale', res.data);
      setPositionScale(normalizePositionScale(positionScaleValue, fixedPositionScale));

      setPassMarkPercentage(String(findSettingValue('pass_mark_percentage', res.data) || '50'));
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [normalizeGradeScale, normalizePositionScale, parseJsonSetting]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: string, value: any) => {
    try {
      await api.put(`/settings/${key}`, { value });
      showSuccess('Setting updated');
      fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update setting');
    }
  };
  
  const getValue = (key: string, settingsList?: Setting[]) => {
    const list = settingsList || settings;
    return list.find(s => s.key === key)?.value;
  };

  const updateJsonSetting = async (key: string, value: any) => {
    try {
      await api.put(`/settings/${key}`, { value, type: 'json' });
      showSuccess('Setting updated');
      fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update setting');
    }
  };

  const updateEndpointToggle = async (moduleKey: keyof EndpointToggles, enabled: boolean) => {
    const next = { ...endpointToggles, [moduleKey]: enabled };
    setEndpointToggles(next);
    await updateJsonSetting('endpoint_toggles', next);
  };

  const saveGradingSettings = async () => {
    try {
      const parsedWaec = waecScale.map((row) => ({
        grade: row.grade,
        min: clampScore(row.min, 0),
      }));
      const parsedLetter = letterScale.map((row) => ({
        grade: row.grade,
        min: clampScore(row.min, 0),
      }));
      const parsedPosition = positionScale.map((row) => ({
        label: row.label,
        min: clampScore(row.min, 0),
      }));
      const passMark = Math.min(100, Math.max(0, Number(passMarkPercentage || 50)));

      await api.put('/settings/bulk', {
        settings: [
          { key: 'grading_scheme', value: gradingScheme, type: 'string' },
          { key: 'grading_scale_waec', value: parsedWaec, type: 'json' },
          { key: 'grading_scale_letter', value: parsedLetter, type: 'json' },
          { key: 'position_grading_scale', value: parsedPosition, type: 'json' },
          { key: 'pass_mark_percentage', value: String(passMark), type: 'string' },
        ],
      });

      showSuccess('Grading settings updated successfully');
      fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update grading settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold mb-4 dark:text-white">System Settings</h1>
        {loading ? (
          <p className="dark:text-gray-300">Loading...</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Name */}
          <div className="border dark:border-gray-700 rounded p-4 md:col-span-2 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">System Name</h2>
            <input
              type="text"
              value={systemName}
              onChange={e => setSystemName(e.target.value)}
              onBlur={e => updateSetting('system_name', e.target.value)}
              className="border dark:border-gray-600 rounded px-3 py-2 w-full bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Enter system name"
              aria-label="System name"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This name will appear throughout the application</p>
          </div>
          
          {/* Registration Settings */}
          <div className="border dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Registration</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!getValue('student_registration_open')}
                onChange={e => updateSetting('student_registration_open', e.target.checked ? '1' : '0')}
              />
              Allow new student registrations
            </label>
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={!!getValue('allow_exam_retakes')}
                onChange={e => updateSetting('allow_exam_retakes', e.target.checked ? '1' : '0')}
              />
              Allow exam retakes
            </label>
            <div className="mt-3">
              <label className="text-sm">Max exam attempts</label>
              <input
                type="number"
                defaultValue={getValue('max_exam_attempts') || '1'}
                min={1}
                onBlur={e => updateSetting('max_exam_attempts', e.target.value)}
                className="border rounded px-2 py-1 w-32 ml-2"
                aria-label="Maximum exam attempts"
              />
            </div>
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Registration Number Format</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm block mb-1">Prefix</label>
                  <input
                    type="text"
                    defaultValue={getValue('registration_number_prefix') || 'REG'}
                    onBlur={e => updateSetting('registration_number_prefix', e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="REG"
                    aria-label="Registration number prefix"
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Year</label>
                  <input
                    type="text"
                    defaultValue={getValue('registration_number_year') || new Date().getFullYear().toString()}
                    onBlur={e => updateSetting('registration_number_year', e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="2025"
                    aria-label="Registration number year"
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Separator</label>
                  <input
                    type="text"
                    defaultValue={getValue('registration_number_separator') || '/'}
                    onBlur={e => updateSetting('registration_number_separator', e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="/"
                    aria-label="Registration number separator"
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Padding</label>
                  <input
                    type="number"
                    defaultValue={getValue('registration_number_padding') || '4'}
                    min={1}
                    max={8}
                    onBlur={e => updateSetting('registration_number_padding', e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="4"
                    aria-label="Registration number padding"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Example: <span className="font-mono">REG/2025/0001</span></p>
            </div>
          </div>

          {/* Exam Window */}
          <div className="border dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Exam Window (Daily)</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Start:</label>
              <input
                type="time"
                defaultValue={getValue('exam_window_start') || '08:00'}
                onBlur={e => updateSetting('exam_window_start', e.target.value)}
                className="border rounded px-2 py-1"
                aria-label="Exam window start time"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-sm w-24">End:</label>
              <input
                type="time"
                defaultValue={getValue('exam_window_end') || '17:00'}
                onBlur={e => updateSetting('exam_window_end', e.target.value)}
                className="border rounded px-2 py-1"
                aria-label="Exam window end time"
              />
            </div>
          </div>

          {/* Security Settings */}
          <div className="border dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Security</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!getValue('require_email_verification')}
                onChange={e => updateSetting('require_email_verification', e.target.checked ? '1' : '0')}
              />
              Require email verification for new accounts
            </label>
            <div className="mt-3">
              <label className="text-sm">Auto logout (minutes)</label>
              <input
                type="number"
                defaultValue={getValue('auto_logout_minutes') || '60'}
                min={5}
                onBlur={e => updateSetting('auto_logout_minutes', e.target.value)}
                className="border rounded px-2 py-1 w-32 ml-2"
                aria-label="Auto logout in minutes"
              />
            </div>
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={!!getValue('debug_logging')}
                onChange={e => updateSetting('debug_logging', e.target.checked ? '1' : '0')}
              />
              Enable debug logging
            </label>
            <div className="mt-3">
              <label className="text-sm">CBT tab-fencing max violations</label>
              <input
                type="number"
                defaultValue={getValue('cbt_tab_fencing_max_violations') || '3'}
                min={1}
                onBlur={e => updateSetting('cbt_tab_fencing_max_violations', e.target.value)}
                className="border rounded px-2 py-1 w-32 ml-2"
                aria-label="CBT tab-fencing maximum violations"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-submit exam attempt when a student reaches this tab-fencing warning count.
              </p>
            </div>
          </div>

          {/* Endpoint Controls */}
          <div className="border dark:border-gray-700 rounded p-4 md:col-span-2 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Endpoint Module Controls</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Disable any module to block its API endpoints system-wide. Changes apply immediately.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['students', 'Students Module'],
                ['exams', 'Exams + CBT Runtime'],
                ['questions', 'Question Management'],
                ['academics', 'Academics (Subjects/Classes/Departments)'],
                ['results', 'Results + Marking + Reports'],
                ['announcements', 'Announcements'],
                ['allocations', 'Allocations + Halls'],
                ['admin_users_roles', 'Admin Users & Roles'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
                  <span className="dark:text-gray-200">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(endpointToggles[key as keyof EndpointToggles])}
                    onChange={(e) => updateEndpointToggle(key as keyof EndpointToggles, e.target.checked)}
                    aria-label={`${label} toggle`}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="border dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Appearance</h2>
            <label className="text-sm mr-2 dark:text-gray-300">Theme</label>
            <select
              value={theme}
              onChange={async (e) => {
                const newTheme = e.target.value as 'light' | 'dark' | 'auto';
                try {
                  await changeTheme(newTheme);
                  showSuccess(`Theme changed to ${newTheme}`);
                } catch (error) {
                  showError('Failed to change theme');
                }
              }}
              className="border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
              aria-label="Theme selection"
            >
              <option value="auto">Auto (System)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Auto adjusts based on your device's time or system preference
            </p>
          </div>

          {/* Grading & Positioning */}
          <div className="border dark:border-gray-700 rounded p-4 md:col-span-2 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Grading & Position Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1 dark:text-gray-200">Grading Scheme</label>
                <select
                  value={gradingScheme}
                  onChange={(e) => setGradingScheme(e.target.value as 'waec' | 'letter' | 'position')}
                  className="border dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-700 dark:text-white"
                >
                  <option value="waec">WAEC (A1, B2, ... F9)</option>
                  <option value="letter">Letter (A, B, C, ...)</option>
                  <option value="position">Position (1st, 2nd, 3rd ...)</option>
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1 dark:text-gray-200">Default Pass Mark (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passMarkPercentage}
                  onChange={(e) => setPassMarkPercentage(e.target.value)}
                  className="border dark:border-gray-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div
              className={`grid grid-cols-1 gap-4 mt-4 ${gradingScheme === 'position' ? '' : 'lg:grid-cols-2'}`}
            >
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                <h3 className="text-sm font-semibold mb-2 dark:text-gray-100">
                  {gradingScheme === 'waec'
                    ? 'WAEC Grade Thresholds'
                    : gradingScheme === 'letter'
                      ? 'Letter Grade Thresholds'
                      : 'Position Grade Thresholds'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {gradingScheme === 'position'
                    ? 'Position labels are fixed. Enter the minimum score for each position band.'
                    : 'Grade labels are fixed. Enter only the minimum score for each grade.'}
                </p>
                <div className="space-y-2">
                  {(gradingScheme === 'waec' ? waecScale : gradingScheme === 'letter' ? letterScale : positionScale).map((row, index) => (
                    <div
                      key={gradingScheme === 'position' ? (row as PositionScaleRow).label : (row as GradeScaleRow).grade}
                      className="grid grid-cols-[90px_1fr] items-center gap-3"
                    >
                      <div className="text-sm font-semibold dark:text-gray-100">
                        {gradingScheme === 'position' ? (row as PositionScaleRow).label : (row as GradeScaleRow).grade}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.min}
                        onChange={(e) => (
                          gradingScheme === 'position'
                            ? updatePositionMin(index, e.target.value)
                            : updateScaleMin(
                                index,
                                e.target.value,
                                gradingScheme === 'waec' ? setWaecScale : setLetterScale
                              )
                        )}
                        className="border dark:border-gray-600 rounded px-2 py-1.5 w-full bg-white dark:bg-gray-700 dark:text-white text-sm"
                        aria-label={`${gradingScheme === 'position' ? (row as PositionScaleRow).label : (row as GradeScaleRow).grade} minimum score`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {gradingScheme !== 'position' && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <h3 className="text-sm font-semibold mb-2 dark:text-gray-100">Position Thresholds</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Position labels are fixed. Enter the minimum score for each position band.
                  </p>
                  <div className="space-y-2">
                    {positionScale.map((row, index) => (
                      <div key={row.label} className="grid grid-cols-[90px_1fr] items-center gap-3">
                        <div className="text-sm font-semibold dark:text-gray-100">{row.label}</div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row.min}
                          onChange={(e) => updatePositionMin(index, e.target.value)}
                          className="border dark:border-gray-600 rounded px-2 py-1.5 w-full bg-white dark:bg-gray-700 dark:text-white text-sm"
                          aria-label={`${row.label} minimum score`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={saveGradingSettings}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Save Grading Settings
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Example: set A1 to <span className="font-semibold">75</span> and B2 to <span className="font-semibold">70</span>.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminSettings;
