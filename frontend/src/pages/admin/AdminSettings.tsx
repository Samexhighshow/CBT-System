import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
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

type SettingsTab = 'general' | 'registration' | 'security' | 'modules' | 'appearance' | 'grading' | 'results';
type GradingScheme = 'waec' | 'letter' | 'position';
type Term = 'First Term' | 'Second Term' | 'Third Term';

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

const findSettingValue = (key: string, settingsList: Setting[]) => settingsList.find((s) => s.key === key)?.value;
const normalizeTerm = (value: string): Term => (value === 'Second Term' || value === 'Third Term' ? value : 'First Term');
const clamp = (value: any, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, num));
};
const asBoolean = (value: any, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const tabs: Array<{ key: SettingsTab; label: string; icon: string }> = [
  { key: 'general', label: 'General', icon: 'bx-cog' },
  { key: 'registration', label: 'Registration', icon: 'bx-id-card' },
  { key: 'security', label: 'Security', icon: 'bx-shield-quarter' },
  { key: 'modules', label: 'Modules', icon: 'bx-slider-alt' },
  { key: 'appearance', label: 'Appearance', icon: 'bx-palette' },
  { key: 'grading', label: 'Grading', icon: 'bx-bar-chart-alt-2' },
  { key: 'results', label: 'CR / Terms', icon: 'bx-line-chart' },
];

const cardClass = 'border dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800';

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const [systemName, setSystemName] = useState('');
  const [endpointToggles, setEndpointToggles] = useState<EndpointToggles>(defaultEndpointToggles);
  const [gradingScheme, setGradingScheme] = useState<GradingScheme>('waec');
  const [waecScale, setWaecScale] = useState<GradeScaleRow[]>(fixedWaecScale);
  const [letterScale, setLetterScale] = useState<GradeScaleRow[]>(fixedLetterScale);
  const [positionScale, setPositionScale] = useState<PositionScaleRow[]>(fixedPositionScale);
  const [passMarkPercentage, setPassMarkPercentage] = useState('50');

  const [currentAcademicSession, setCurrentAcademicSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState<Term>('First Term');
  const [enableTermCompilation, setEnableTermCompilation] = useState(true);
  const [enableCumulativeResults, setEnableCumulativeResults] = useState(true);
  const [defaultCaWeight, setDefaultCaWeight] = useState('40');
  const [defaultExamWeight, setDefaultExamWeight] = useState('60');
  const [useAssessmentWeight, setUseAssessmentWeight] = useState(true);

  const { theme, changeTheme } = useTheme();

  const parseJson = useCallback((value: any, fallback: any) => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }, []);

  const normalizeScale = useCallback((value: any, fixedRows: GradeScaleRow[]) => {
    const entries = Array.isArray(parseJson(value, fixedRows)) ? parseJson(value, fixedRows) : fixedRows;
    const minByGrade = new Map<string, number>();
    entries.forEach((entry: any) => {
      const grade = String(entry?.grade || '').trim().toUpperCase();
      if (!grade) return;
      minByGrade.set(grade, clamp(entry?.min, 0));
    });
    return fixedRows.map((row) => ({ grade: row.grade, min: minByGrade.has(row.grade) ? clamp(minByGrade.get(row.grade), row.min) : row.min }));
  }, [parseJson]);

  const normalizePosition = useCallback((value: any, fixedRows: PositionScaleRow[]) => {
    const entries = Array.isArray(parseJson(value, fixedRows)) ? parseJson(value, fixedRows) : fixedRows;
    const minByLabel = new Map<string, number>();
    entries.forEach((entry: any) => {
      const label = String(entry?.label || '').trim().toLowerCase();
      if (!label) return;
      minByLabel.set(label, clamp(entry?.min, 0));
    });
    return fixedRows.map((row) => ({ label: row.label, min: minByLabel.has(row.label.toLowerCase()) ? clamp(minByLabel.get(row.label.toLowerCase()), row.min) : row.min }));
  }, [parseJson]);

  const getValue = (key: string) => settings.find((s) => s.key === key)?.value;

  const updateSetting = async (key: string, value: any, type?: 'string' | 'boolean' | 'json') => {
    try {
      await api.put(`/settings/${key}`, { value, ...(type ? { type } : {}) });
      showSuccess('Setting updated');
      await fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update setting');
    }
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const rows: Setting[] = res.data || [];
      setSettings(rows);

      setSystemName(findSettingValue('system_name', rows) || 'CBT System');
      setEndpointToggles({ ...defaultEndpointToggles, ...(parseJson(findSettingValue('endpoint_toggles', rows), defaultEndpointToggles) || {}) });

      const scheme = String(findSettingValue('grading_scheme', rows) || 'waec').toLowerCase();
      setGradingScheme(scheme === 'letter' ? 'letter' : scheme === 'position' ? 'position' : 'waec');
      setWaecScale(normalizeScale(findSettingValue('grading_scale_waec', rows), fixedWaecScale));
      setLetterScale(normalizeScale(findSettingValue('grading_scale_letter', rows), fixedLetterScale));
      setPositionScale(normalizePosition(findSettingValue('position_grading_scale', rows), fixedPositionScale));
      setPassMarkPercentage(String(findSettingValue('pass_mark_percentage', rows) || '50'));

      const year = new Date().getFullYear();
      setCurrentAcademicSession(String(findSettingValue('current_academic_session', rows) || `${year}/${year + 1}`));
      setCurrentTerm(normalizeTerm(String(findSettingValue('current_term', rows) || 'First Term')));
      setEnableTermCompilation(asBoolean(findSettingValue('enable_term_result_compilation', rows), true));
      setEnableCumulativeResults(asBoolean(findSettingValue('enable_cumulative_results', rows), true));
      setDefaultCaWeight(String(findSettingValue('default_ca_weight', rows) || '40'));
      setDefaultExamWeight(String(findSettingValue('default_exam_weight', rows) || '60'));
      setUseAssessmentWeight(asBoolean(findSettingValue('use_exam_assessment_weight', rows), true));
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [normalizePosition, normalizeScale, parseJson]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveGradingSettings = async () => {
    try {
      await api.put('/settings/bulk', {
        settings: [
          { key: 'grading_scheme', value: gradingScheme, type: 'string' },
          { key: 'grading_scale_waec', value: waecScale, type: 'json' },
          { key: 'grading_scale_letter', value: letterScale, type: 'json' },
          { key: 'position_grading_scale', value: positionScale, type: 'json' },
          { key: 'pass_mark_percentage', value: String(clamp(passMarkPercentage, 50)), type: 'string' },
        ],
      });
      showSuccess('Grading settings updated');
      await fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save grading settings');
    }
  };

  const saveResultCompilationSettings = async () => {
    try {
      await api.put('/settings/bulk', {
        settings: [
          { key: 'current_academic_session', value: currentAcademicSession.trim(), type: 'string' },
          { key: 'current_term', value: currentTerm, type: 'string' },
          { key: 'enable_term_result_compilation', value: enableTermCompilation, type: 'boolean' },
          { key: 'enable_cumulative_results', value: enableCumulativeResults, type: 'boolean' },
          { key: 'default_ca_weight', value: String(clamp(defaultCaWeight, 40)), type: 'string' },
          { key: 'default_exam_weight', value: String(clamp(defaultExamWeight, 60)), type: 'string' },
          { key: 'use_exam_assessment_weight', value: useAssessmentWeight, type: 'boolean' },
        ],
      });
      showSuccess('CR settings updated');
      await fetchSettings();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save CR settings');
    }
  };

  const endpointRows: Array<[keyof EndpointToggles, string]> = [
    ['students', 'Students Module'],
    ['exams', 'Exams + CBT Runtime'],
    ['questions', 'Question Management'],
    ['academics', 'Academics (Subjects/Classes/Departments)'],
    ['results', 'Results + Marking + Reports'],
    ['announcements', 'Announcements'],
    ['allocations', 'Allocations + Halls'],
    ['admin_users_roles', 'Admin Users & Roles'],
  ];

  const selectedScale = useMemo(() => (
    gradingScheme === 'waec' ? waecScale : gradingScheme === 'letter' ? letterScale : positionScale
  ), [gradingScheme, letterScale, positionScale, waecScale]);

  const sidebarButtonClass = (tab: SettingsTab) => `w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
    activeTab === tab
      ? 'bg-blue-600 text-white'
      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700'
  }`;

  const renderTab = () => {
    if (activeTab === 'general') {
      return (
        <div className={cardClass}>
          <h2 className="font-semibold mb-2 dark:text-white">System Name</h2>
          <input
            type="text"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            onBlur={(e) => updateSetting('system_name', e.target.value)}
            className="border dark:border-gray-600 rounded px-3 py-2 w-full bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>
      );
    }

    if (activeTab === 'registration') {
      return (
        <div className="space-y-6">
          <div className={cardClass}>
            <h2 className="font-semibold mb-2 dark:text-white">Registration</h2>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={asBoolean(getValue('student_registration_open'), true)} onChange={(e) => updateSetting('student_registration_open', e.target.checked ? '1' : '0')} />
              Allow new student registrations
            </label>
            <label className="flex items-center gap-2 mt-3">
              <input type="checkbox" checked={asBoolean(getValue('allow_exam_retakes'), false)} onChange={(e) => updateSetting('allow_exam_retakes', e.target.checked ? '1' : '0')} />
              Allow exam retakes
            </label>
            <div className="mt-3">
              <label className="text-sm">Max exam attempts</label>
              <input type="number" defaultValue={getValue('max_exam_attempts') || '1'} min={1} onBlur={(e) => updateSetting('max_exam_attempts', e.target.value)} className="border rounded px-2 py-1 w-32 ml-2" />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="font-semibold mb-2 dark:text-white">Registration Number Format</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input type="text" defaultValue={getValue('registration_number_prefix') || 'REG'} onBlur={(e) => updateSetting('registration_number_prefix', e.target.value)} className="border rounded px-2 py-1 w-full" placeholder="Prefix" />
              <input type="text" defaultValue={getValue('registration_number_year') || new Date().getFullYear().toString()} onBlur={(e) => updateSetting('registration_number_year', e.target.value)} className="border rounded px-2 py-1 w-full" placeholder="Year" />
              <input type="text" defaultValue={getValue('registration_number_separator') || '/'} onBlur={(e) => updateSetting('registration_number_separator', e.target.value)} className="border rounded px-2 py-1 w-full" placeholder="Separator" />
              <input type="number" defaultValue={getValue('registration_number_padding') || '4'} min={1} max={8} onBlur={(e) => updateSetting('registration_number_padding', e.target.value)} className="border rounded px-2 py-1 w-full" placeholder="Padding" />
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="font-semibold mb-2 dark:text-white">Exam Window (Daily)</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Start:</label>
              <input type="time" defaultValue={getValue('exam_window_start') || '08:00'} onBlur={(e) => updateSetting('exam_window_start', e.target.value)} className="border rounded px-2 py-1" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-sm w-24">End:</label>
              <input type="time" defaultValue={getValue('exam_window_end') || '17:00'} onBlur={(e) => updateSetting('exam_window_end', e.target.value)} className="border rounded px-2 py-1" />
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'security') {
      return (
        <div className={cardClass}>
          <h2 className="font-semibold mb-2 dark:text-white">Security</h2>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={asBoolean(getValue('require_email_verification'), true)} onChange={(e) => updateSetting('require_email_verification', e.target.checked ? '1' : '0')} />
            Require email verification for new accounts
          </label>
          <div className="mt-3">
            <label className="text-sm">Auto logout (minutes)</label>
            <input type="number" defaultValue={getValue('auto_logout_minutes') || '60'} min={5} onBlur={(e) => updateSetting('auto_logout_minutes', e.target.value)} className="border rounded px-2 py-1 w-32 ml-2" />
          </div>
          <div className="mt-3">
            <label className="text-sm">CBT tab-fencing max violations</label>
            <input type="number" defaultValue={getValue('cbt_tab_fencing_max_violations') || '3'} min={1} onBlur={(e) => updateSetting('cbt_tab_fencing_max_violations', e.target.value)} className="border rounded px-2 py-1 w-32 ml-2" />
          </div>
        </div>
      );
    }

    if (activeTab === 'modules') {
      return (
        <div className={cardClass}>
          <h2 className="font-semibold mb-2 dark:text-white">Endpoint Module Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {endpointRows.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
                <span className="dark:text-gray-200">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(endpointToggles[key])}
                  onChange={async (e) => {
                    const next = { ...endpointToggles, [key]: e.target.checked };
                    setEndpointToggles(next);
                    await updateSetting('endpoint_toggles', next, 'json');
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'appearance') {
      return (
        <div className={cardClass}>
          <h2 className="font-semibold mb-2 dark:text-white">Appearance</h2>
          <label className="text-sm mr-2 dark:text-gray-300">Theme</label>
          <select
            value={theme}
            onChange={async (e) => {
              const value = e.target.value as 'light' | 'dark' | 'auto';
              try {
                await changeTheme(value);
                showSuccess(`Theme changed to ${value}`);
              } catch {
                showError('Failed to change theme');
              }
            }}
            className="border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="auto">Auto (System)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      );
    }

    if (activeTab === 'grading') {
      return (
        <div className={cardClass}>
          <h2 className="font-semibold mb-2 dark:text-white">Grading & Position Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={gradingScheme} onChange={(e) => setGradingScheme(e.target.value as GradingScheme)} className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white">
              <option value="waec">WAEC (A1, B2, ... F9)</option>
              <option value="letter">Letter (A, B, C, ...)</option>
              <option value="position">Position (1st, 2nd, 3rd ...)</option>
            </select>
            <input type="number" min={0} max={100} value={passMarkPercentage} onChange={(e) => setPassMarkPercentage(e.target.value)} className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white" />
          </div>

          <div className="mt-4 space-y-2">
            {selectedScale.map((row, index) => (
              <div key={'grade' in row ? row.grade : row.label} className="grid grid-cols-[100px_1fr] items-center gap-3">
                <div className="text-sm font-semibold">{'grade' in row ? row.grade : row.label}</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.min}
                  onChange={(e) => {
                    const value = clamp(e.target.value, row.min);
                    if (gradingScheme === 'waec') {
                      setWaecScale((prev) => prev.map((item, i) => (i === index ? { ...item, min: value } : item)));
                    } else if (gradingScheme === 'letter') {
                      setLetterScale((prev) => prev.map((item, i) => (i === index ? { ...item, min: value } : item)));
                    } else {
                      setPositionScale((prev) => prev.map((item, i) => (i === index ? { ...item, min: value } : item)));
                    }
                  }}
                  className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            ))}
          </div>

          {gradingScheme !== 'position' && (
            <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded p-3">
              <h3 className="text-sm font-semibold mb-2">Position Thresholds</h3>
              <div className="space-y-2">
                {positionScale.map((row, index) => (
                  <div key={row.label} className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <div className="text-sm font-semibold">{row.label}</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row.min}
                      onChange={(e) => setPositionScale((prev) => prev.map((item, i) => (i === index ? { ...item, min: clamp(e.target.value, item.min) } : item)))}
                      className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={saveGradingSettings} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save Grading Settings</button>
          </div>
        </div>
      );
    }

    return (
      <div className={cardClass}>
        <h2 className="font-semibold mb-2 dark:text-white">Cumulative Results (CR) & Term Compilation</h2>
        <p className="text-xs text-gray-500 mb-4">Second term CR = (First + Second) / 2. Third term CR = (First + Second + Third) / 3.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" value={currentAcademicSession} onChange={(e) => setCurrentAcademicSession(e.target.value)} placeholder="Academic session (e.g. 2025/2026)" className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white" />
          <select value={currentTerm} onChange={(e) => setCurrentTerm(normalizeTerm(e.target.value))} className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white">
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>
          <input type="number" min={0} max={100} value={defaultCaWeight} onChange={(e) => setDefaultCaWeight(e.target.value)} placeholder="Default CA Weight" className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white" />
          <input type="number" min={0} max={100} value={defaultExamWeight} onChange={(e) => setDefaultExamWeight(e.target.value)} placeholder="Default Exam Weight" className="border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white" />
        </div>

        <div className="space-y-2 mt-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={enableTermCompilation} onChange={(e) => setEnableTermCompilation(e.target.checked)} /> Enable term result compilation (CA + Exam)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={enableCumulativeResults} onChange={(e) => setEnableCumulativeResults(e.target.checked)} /> Enable cumulative result (CR) across terms</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={useAssessmentWeight} onChange={(e) => setUseAssessmentWeight(e.target.checked)} /> Use per-exam assessment weight when available</label>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={saveResultCompilationSettings} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Save CR Settings</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold mb-4 dark:text-white">System Settings</h1>
        {loading ? (
          <p className="dark:text-gray-300">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
            <aside className="space-y-2">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" className={sidebarButtonClass(tab.key)} onClick={() => setActiveTab(tab.key)}>
                  <i className={`bx ${tab.icon} text-base`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </aside>
            <section>{renderTab()}</section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
