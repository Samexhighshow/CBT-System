import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { showSuccess, showError } from '../../utils/alerts';

interface Exam {
  id: number;
  title: string;
  subject_name: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface GeneratedAccess {
  id: number;
  student_reg_number: string;
  student_name: string;
  exam_title: string;
  access_code: string;
  generated_at: string;
  used: boolean;
  used_at: string | null; 
}

const ExamAccess: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [regNumbers, setRegNumbers] = useState<string>('');
  const [generatedAccess, setGeneratedAccess] = useState<GeneratedAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUsed, setFilterUsed] = useState<'all' | 'used' | 'unused'>('all');

  useEffect(() => {
    fetchTodayExams();
    fetchGeneratedAccess();
  }, []);

  const fetchTodayExams = async () => {
    try {
      const response = await api.get('/admin/exams/today');
      setExams(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch today exams:', error);
      showError('Failed to load today\'s exams');
    }
  };

  const fetchGeneratedAccess = async () => {
    try {
      const response = await api.get('/admin/exam-access');
      setGeneratedAccess(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch exam access:', error);
    }
  };

  const handleGenerateAccess = async () => {
    if (!selectedExam) {
      showError('Please select an exam');
      return;
    }

    if (!regNumbers.trim()) {
      showError('Please enter at least one registration number');
      return;
    }

    // Parse reg numbers - support comma, space, or newline separated
    const regNumberList = regNumbers
      .split(/[,\s\n]+/)
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (regNumberList.length === 0) {
      showError('No valid registration numbers found');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/admin/exam-access/generate', {
        exam_id: selectedExam,
        reg_numbers: regNumberList,
      });

      showSuccess(response.data.message || `Generated access codes for ${regNumberList.length} student(s)`);
      setRegNumbers('');
      setSelectedExam(null);
      fetchGeneratedAccess();
    } catch (error: any) {
      console.error('Failed to generate access:', error);
      showError(error.response?.data?.message || 'Failed to generate access codes');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (accessId: number) => {
    if (!window.confirm('Are you sure you want to revoke this access code?')) {
      return;
    }

    try {
      await api.delete(`/admin/exam-access/${accessId}`);
      showSuccess('Access code revoked successfully');
      fetchGeneratedAccess();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to revoke access code');
    }
  };

  const filteredAccess = generatedAccess.filter(access => {
    const matchesSearch = 
      access.student_reg_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      access.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      access.exam_title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = 
      filterUsed === 'all' ||
      (filterUsed === 'used' && access.used) ||
      (filterUsed === 'unused' && !access.used);

    return matchesSearch && matchesFilter;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
  };

  return (
    <div className="app-shell py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Exam Access Management
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Generate one-time passwords for students on exam day
          </p>
        </div>

        {/* Generate Access Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Generate Access Codes
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Select Exam */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Exam (Today)
              </label>
              <select
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                title="Select Exam (Today)"
              >
                <option value="">-- Select an exam --</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} - {exam.subject_name} ({exam.start_time} - {exam.end_time})
                  </option>
                ))}
              </select>
              {exams.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  No exams scheduled for today
                </p>
              )}
            </div>

            {/* Registration Numbers Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Registration Numbers
              </label>
              <textarea
                value={regNumbers}
                onChange={(e) => setRegNumbers(e.target.value)}
                placeholder="Enter reg numbers (comma, space, or line separated)&#10;Example: REG001, REG002&#10;or one per line"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You can paste multiple reg numbers separated by commas, spaces, or new lines
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleGenerateAccess}
              disabled={loading || !selectedExam || !regNumbers.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <i className="bx bx-loader-alt animate-spin"></i>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <i className="bx bx-key"></i>
                  <span>Generate Access Codes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Access Codes Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Generated Access Codes
            </h2>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by reg number, name, or exam..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <select
                  value={filterUsed}
                  onChange={(e) => setFilterUsed(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  title="Filter by status"
                >
                  <option value="all">All Codes</option>
                  <option value="unused">Unused</option>
                  <option value="used">Used</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Reg Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Access Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Generated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAccess.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <i className="bx bx-key text-4xl mb-2"></i>
                      <p>No access codes generated yet</p>
                    </td>
                  </tr>
                ) : (
                  filteredAccess.map((access) => (
                    <tr key={access.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {access.student_reg_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {access.student_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {access.exam_title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <code className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 rounded font-mono text-sm">
                            {access.access_code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(access.access_code)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Copy code"
                          >
                            <i className="bx bx-copy text-lg"></i>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {access.used ? (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                            Used {access.used_at && `(${new Date(access.used_at).toLocaleTimeString()})`}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                            Unused
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(access.generated_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {!access.used && (
                          <button
                            onClick={() => handleRevokeAccess(access.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Revoke access"
                          >
                            <i className="bx bx-trash text-lg"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <i className="bx bx-info-circle text-blue-600 dark:text-blue-400 text-xl flex-shrink-0 mt-0.5"></i>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-2">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Select an exam scheduled for today</li>
                <li>Enter student registration numbers (one or multiple)</li>
                <li>System generates unique one-time passwords for each student</li>
                <li>Each code can only be used once - after use, it becomes invalid</li>
                <li>Students need a new code for each exam session (morning/afternoon)</li>
                <li>Unused codes can be revoked if needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamAccess;
