import React, { useEffect, useState } from 'react';
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

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemName, setSystemName] = useState('');
  const { theme, changeTheme } = useTheme();
  // Token is injected via axios interceptor in `api` using `auth_token` key

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      
      // Load system name
      setSystemName(getValue('system_name', res.data) || 'CBT System');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
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

          {/* Grading Scale */}
          <div className="border dark:border-gray-700 rounded p-4 md:col-span-2 bg-white dark:bg-gray-800">
            <h2 className="font-semibold mb-2 dark:text-white">Grading Scale (JSON)</h2>
            <textarea
              defaultValue={getValue('grading_scale') || '{"A":80,"B":70,"C":60,"D":50,"F":0}'}
              onBlur={e => updateSetting('grading_scale', e.target.value)}
              className="border dark:border-gray-600 rounded px-3 py-2 w-full h-28 bg-white dark:bg-gray-700 dark:text-white"
              aria-label="Grading scale JSON"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Example: {`{"A":80,"B":70,"C":60,"D":50,"F":0}`}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminSettings;
