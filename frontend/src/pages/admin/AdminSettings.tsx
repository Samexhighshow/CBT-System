import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { showSuccess, showError } from '../../utils/alerts';

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
  // Token is injected via axios interceptor in `api` using `auth_token` key

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
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

  const getValue = (key: string) => settings.find(s => s.key === key)?.value;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">System Settings</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Registration</h2>
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
          </div>

          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Exam Window (Daily)</h2>
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

          <div className="border rounded p-4">
            <h2 className="font-semibold mb-2">Security</h2>
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
        </div>
          <div className="border rounded p-4 md:col-span-2">
            <h2 className="font-semibold mb-2">Appearance</h2>
            <label className="text-sm mr-2">Theme</label>
            <select
              defaultValue={getValue('theme') || 'auto'}
              onChange={e => updateSetting('theme', e.target.value)}
              className="border rounded px-2 py-1"
              aria-label="Theme selection"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="border rounded p-4 md:col-span-2">
            <h2 className="font-semibold mb-2">Grading Scale (JSON)</h2>
            <textarea
              defaultValue={getValue('grading_scale') || '{"A":80,"B":70,"C":60,"D":50,"F":0}'}
              onBlur={e => updateSetting('grading_scale', e.target.value)}
              className="border rounded px-3 py-2 w-full h-28"
              aria-label="Grading scale JSON"
            />
            <p className="text-xs text-gray-500 mt-1">Example: {`{"A":80,"B":70,"C":60,"D":50,"F":0}`}</p>
          </div>
      )}
    </div>
  );
};

export default AdminSettings;
