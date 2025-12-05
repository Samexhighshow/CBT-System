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
  const [systemName, setSystemName] = useState('');
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_from: '',
  });
  // Token is injected via axios interceptor in `api` using `auth_token` key

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      
      // Load system name
      setSystemName(getValue('system_name', res.data) || 'CBT System');
      
      // Load email settings
      setEmailSettings({
        smtp_host: getValue('smtp_host', res.data) || '',
        smtp_port: getValue('smtp_port', res.data) || '587',
        smtp_user: getValue('smtp_user', res.data) || '',
        smtp_from: getValue('smtp_from', res.data) || '',
      });
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
  
  const saveEmailSettings = async () => {
    try {
      await Promise.all([
        api.put('/settings/smtp_host', { value: emailSettings.smtp_host }),
        api.put('/settings/smtp_port', { value: emailSettings.smtp_port }),
        api.put('/settings/smtp_user', { value: emailSettings.smtp_user }),
        api.put('/settings/smtp_from', { value: emailSettings.smtp_from }),
      ]);
      showSuccess('Email settings updated successfully');
      fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update email settings');
    }
  };

  const getValue = (key: string, settingsList?: Setting[]) => {
    const list = settingsList || settings;
    return list.find(s => s.key === key)?.value;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">System Settings</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Name */}
          <div className="border rounded p-4 md:col-span-2">
            <h2 className="font-semibold mb-2">System Name</h2>
            <input
              type="text"
              value={systemName}
              onChange={e => setSystemName(e.target.value)}
              onBlur={e => updateSetting('system_name', e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter system name"
              aria-label="System name"
            />
            <p className="text-xs text-gray-500 mt-1">This name will appear throughout the application</p>
          </div>
          
          {/* Registration Settings */}
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

          {/* Email Settings */}
          <div className="border rounded p-4 md:col-span-2">
            <h2 className="font-semibold mb-3">Email Settings (SMTP)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm block mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={emailSettings.smtp_host}
                  onChange={e => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="smtp.gmail.com"
                  aria-label="SMTP host"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={emailSettings.smtp_port}
                  onChange={e => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="587"
                  aria-label="SMTP port"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={emailSettings.smtp_user}
                  onChange={e => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="your-email@example.com"
                  aria-label="SMTP username"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">From Email</label>
                <input
                  type="email"
                  value={emailSettings.smtp_from}
                  onChange={e => setEmailSettings({ ...emailSettings, smtp_from: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="noreply@example.com"
                  aria-label="From email address"
                />
              </div>
            </div>
            <button
              onClick={saveEmailSettings}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Email Settings
            </button>
          </div>

          {/* Security Settings */}
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

          {/* Appearance Settings */}
          <div className="border rounded p-4">
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

          {/* Grading Scale */}
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
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminSettings;
