import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/alerts';
import { api } from '../services/api';

interface OfflineCode {
  code: string;
  exam_ids: number[];
  generated_at: string;
  synced: boolean;
}

const AccessCodeGenerator: React.FC = () => {
  const { isDark } = useTheme();
  const { user, userRole } = useAuthStore();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [offlineCodes, setOfflineCodes] = useState<OfflineCode[]>([]);
  const [showOfflineCodes, setShowOfflineCodes] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-gray-100' : 'text-gray-900';
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-600';

  // Check if user has permission (admin, moderator, teacher)
  const hasAccess = user && ['Admin', 'Main Admin', 'Moderator', 'Teacher'].some(role => user.role?.includes(role));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchExams();
      loadOfflineCodes();
    }
  }, [hasAccess]);

  const fetchExams = async () => {
    try {
      const response = await api.get('/api/exams');
      setExams(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load exams', err);
    }
  };

  const loadOfflineCodes = () => {
    const stored = localStorage.getItem('offline_access_codes');
    if (stored) {
      try {
        setOfflineCodes(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load offline codes', e);
      }
    }
  };

  const saveOfflineCodes = (newCodes: OfflineCode[]) => {
    localStorage.setItem('offline_access_codes', JSON.stringify(newCodes));
    setOfflineCodes(newCodes);
  };

  const generateCodes = async () => {
    if (selectedExamIds.length === 0) {
      showError('Please select at least one exam');
      return;
    }

    if (quantity < 1 || quantity > 500) {
      showError('Quantity must be between 1 and 500');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/api/access-codes/generate-bulk', {
        exam_ids: selectedExamIds,
        quantity,
      });

      const newCodes = response.data?.data || [];
      setCodes(newCodes.map((c: any) => c.code));

      if (!isOnline) {
        // Save to local storage for offline use
        const codeObjects: OfflineCode[] = newCodes.map((c: any) => ({
          code: c.code,
          exam_ids: selectedExamIds,
          generated_at: new Date().toISOString(),
          synced: false,
        }));
        const updated = [...offlineCodes, ...codeObjects];
        saveOfflineCodes(updated);
        showSuccess(`Generated ${newCodes.length} codes (saved offline)`);
      } else {
        showSuccess(`Generated ${newCodes.length} access codes`);
      }

      setSelectedExamIds([]);
      setQuantity(10);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  const syncOfflineCodes = async () => {
    const unsyncedCodes = offlineCodes.filter(c => !c.synced);
    if (unsyncedCodes.length === 0) {
      showSuccess('All codes are already synced');
      return;
    }

    setSyncing(true);
    try {
      await api.post('/api/access-codes/sync-offline', {
        codes: unsyncedCodes,
      });

      const updated = offlineCodes.map(c => ({
        ...c,
        synced: true,
      }));
      saveOfflineCodes(updated);
      showSuccess(`Synced ${unsyncedCodes.length} codes to server`);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to sync codes');
    } finally {
      setSyncing(false);
    }
  };

  const downloadCodesAsCSV = () => {
    if (codes.length === 0) return;

    const csv = codes.map((code, idx) => `${idx + 1},${code}`).join('\n');
    const header = 'No.,Access Code\n';
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(header + csv)}`);
    element.setAttribute('download', `access_codes_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showSuccess('Codes downloaded as CSV');
  };

  const copyCodesToClipboard = () => {
    if (codes.length === 0) return;
    navigator.clipboard.writeText(codes.join('\n'));
    showSuccess('Codes copied to clipboard');
  };

  if (!hasAccess) {
    return (
      <div className={`min-h-screen ${bgClass} p-6`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-lg border ${cardClass} p-6`}>
            <p className={`text-center ${textClass}`}>
              You don't have permission to access this page. Please contact an administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} p-4 md:p-6`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Access Code Generator</h1>
          <p className={`${mutedClass}`}>Generate and manage exam access codes for students</p>
          <div className="mt-4 flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'border-green-900 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className={`text-sm font-medium ${isOnline ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-yellow-400' : 'text-yellow-700')}`}>
                {isOnline ? 'Online' : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Generator Card */}
        <div className={`rounded-lg border ${cardClass} p-6 mb-6`}>
          <h2 className={`text-xl font-semibold ${textClass} mb-6`}>Generate New Codes</h2>

          {/* Exam Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${textClass} mb-3`}>
              Select Exams
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exams.map(exam => (
                <label
                  key={exam.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedExamIds.includes(exam.id)
                      ? isDark ? 'border-blue-700 bg-blue-900/30' : 'border-blue-300 bg-blue-50'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedExamIds.includes(exam.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedExamIds([...selectedExamIds, exam.id]);
                      } else {
                        setSelectedExamIds(selectedExamIds.filter(id => id !== exam.id));
                      }
                    }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <div className={`font-medium ${textClass}`}>{exam.title}</div>
                    <div className={`text-xs ${mutedClass}`}>{exam.subject}</div>
                  </div>
                </label>
              ))}
            </div>
            {exams.length === 0 && (
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} text-center ${mutedClass}`}>
                No exams available
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${textClass} mb-2`}>
              Number of Codes (1-500)
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(500, Number(e.target.value))))}
              className={`w-full max-w-xs px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateCodes}
            disabled={generating || selectedExamIds.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {generating ? 'Generating...' : `Generate ${quantity} Code${quantity !== 1 ? 's' : ''}`}
          </button>
        </div>

        {/* Generated Codes Display */}
        {codes.length > 0 && (
          <div className={`rounded-lg border ${cardClass} p-6 mb-6`}>
            <h2 className={`text-xl font-semibold ${textClass} mb-4`}>Generated Codes ({codes.length})</h2>

            <div className={`mb-4 p-4 rounded-lg border ${
              isDark ? 'bg-blue-900/30 border-blue-800' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-sm ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>
                These codes are ready to distribute to students. Make sure to save them before navigating away.
              </p>
            </div>

            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} mb-4 max-h-48 overflow-y-auto`}>
              <div className="space-y-1">
                {codes.map((code, idx) => (
                  <div key={idx} className={`text-sm font-mono ${textClass}`}>
                    {idx + 1}. {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={copyCodesToClipboard}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isDark ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Copy All
              </button>
              <button
                onClick={downloadCodesAsCSV}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isDark ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Download CSV
              </button>
              <button
                onClick={() => setCodes([])}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isDark ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Offline Codes Section */}
        {offlineCodes.length > 0 && (
          <div className={`rounded-lg border ${cardClass} p-6 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textClass}`}>
                Offline Codes ({offlineCodes.length})
              </h2>
              <button
                onClick={() => setShowOfflineCodes(!showOfflineCodes)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showOfflineCodes ? 'Hide' : 'View'}
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className={mutedClass}>
                  {offlineCodes.filter(c => !c.synced).length} waiting to sync
                </span>
                {!isOnline && (
                  <span className="text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                    (Will sync when online)
                  </span>
                )}
              </div>
            </div>

            {showOfflineCodes && (
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'} mb-4 max-h-48 overflow-y-auto`}>
                <div className="space-y-1">
                  {offlineCodes.map(({ code, synced }, idx) => (
                    <div key={idx} className={`text-sm font-mono flex items-center gap-2 ${textClass}`}>
                      <span>{code}</span>
                      {synced && <span className="text-xs text-green-600 dark:text-green-400">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isOnline && offlineCodes.some(c => !c.synced) && (
              <button
                onClick={syncOfflineCodes}
                disabled={syncing}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {syncing ? 'Syncing...' : 'Sync All Offline Codes'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessCodeGenerator;
