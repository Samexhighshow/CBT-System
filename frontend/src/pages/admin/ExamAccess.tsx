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

interface Student {
  id: number;
  name: string;
  reg_number: string;
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
  const [regNumber, setRegNumber] = useState<string>('');
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedAccess | null>(null);
  const [generatedAccess, setGeneratedAccess] = useState<GeneratedAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
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
      // Don't show error alert - it's normal if no exams are scheduled
      setExams([]);
    }
  };

  const fetchGeneratedAccess = async () => {
    try {
      const response = await api.get('/admin/exam-access');
      setGeneratedAccess(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch exam access:', error);
      // Don't show error alert - just log it
      setGeneratedAccess([]);
    }
  };

  const handleSearchStudent = async () => {
    if (!regNumber.trim()) {
      showError('Please enter a registration number');
      return;
    }

    if (!selectedExam) {
      showError('Please select an exam first');
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/students/by-reg-number/${regNumber.toUpperCase().trim()}`);
      if (response.status === 200) {
        setFoundStudent(response.data);
        setGeneratedCode(null);
        showSuccess(`Student found: ${response.data.name}`);
      }
    } catch (error: any) {
      console.error('Student not found:', error);
      setFoundStudent(null);
      setGeneratedCode(null);
      showError(error.response?.data?.message || 'Registration number not found in database');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateAccess = async () => {
    if (!selectedExam) {
      showError('Please select an exam');
      return;
    }

    if (!foundStudent) {
      showError('Please search and find a student first');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/admin/exam-access/generate', {
        exam_id: selectedExam,
        student_id: foundStudent.id,
      });

      if (response.data.success) {
        const accessData = response.data.data;
        setGeneratedCode({
          id: accessData.id || 0,
          student_reg_number: accessData.student_reg_number,
          student_name: accessData.student_name,
          exam_title: accessData.exam_title,
          access_code: accessData.access_code,
          generated_at: accessData.generated_at,
          used: false,
          used_at: null,
        });

        showSuccess('Access code generated successfully!');
        fetchGeneratedAccess();
      }
    } catch (error: any) {
      console.error('Failed to generate access:', error);
      showError(error.response?.data?.message || 'Failed to generate access code');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!generatedCode) {
      showError('No access code to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Code - ${generatedCode.student_reg_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; border: 2px solid #333; padding: 30px; text-align: center; }
            .header { margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .exam-info { font-size: 16px; margin-bottom: 20px; color: #555; }
            .student-info { margin-bottom: 30px; }
            .student-label { font-size: 12px; color: #666; }
            .student-value { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .code-section { background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .code-label { font-size: 12px; color: #666; margin-bottom: 10px; }
            .access-code { font-size: 48px; font-weight: bold; letter-spacing: 5px; color: #0066cc; font-family: 'Courier New', monospace; }
            .instructions { text-align: left; margin-top: 30px; font-size: 12px; color: #666; }
            .instructions li { margin-bottom: 8px; }
            .footer { margin-top: 30px; font-size: 10px; color: #999; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">CBT System</div>
              <div class="title">Exam Access Code</div>
            </div>
            
            <div class="exam-info">
              <strong>${generatedCode.exam_title}</strong>
            </div>
            
            <div class="student-info">
              <div class="student-label">Registration Number:</div>
              <div class="student-value">${generatedCode.student_reg_number}</div>
              <div class="student-label">Student Name:</div>
              <div class="student-value">${generatedCode.student_name}</div>
            </div>
            
            <div class="code-section">
              <div class="code-label">Your One-Time Access Code:</div>
              <div class="access-code">${generatedCode.access_code}</div>
            </div>
            
            <div class="instructions">
              <strong>Instructions:</strong>
              <ul>
                <li>This access code is valid for ONE exam only</li>
                <li>Once used, it cannot be used again</li>
                <li>Code expires at the end of exam day</li>
                <li>Keep this code secure and confidential</li>
                <li>Do not share with other students</li>
              </ul>
            </div>
            
            <div class="footer">
              Generated on: ${new Date().toLocaleString()}
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
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

  return (
    <div className="app-shell py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Exam Access Code Generator
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Generate and print one-time access codes for individual students
          </p>
        </div>

        {/* Main Form Card */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Code Generation Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Generate Access Code
            </h2>

            <div className="space-y-4">
              {/* Select Exam */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Exam (Today)
                </label>
                <select
                  value={selectedExam || ''}
                  onChange={(e) => {
                    setSelectedExam(Number(e.target.value) || null);
                    setFoundStudent(null);
                    setGeneratedCode(null);
                    setRegNumber('');
                  }}
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

              {/* Student Registration Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Student Registration Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => {
                      setRegNumber(e.target.value.toUpperCase());
                      setFoundStudent(null);
                      setGeneratedCode(null);
                    }}
                    placeholder="Enter reg number (e.g., REG001)"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white uppercase"
                    disabled={!selectedExam}
                  />
                  <button
                    onClick={handleSearchStudent}
                    disabled={searching || !selectedExam || !regNumber.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-2 flex-shrink-0"
                    title="Search student"
                  >
                    {searching ? (
                      <>
                        <i className="bx bx-loader-alt animate-spin"></i>
                        <span className="hidden sm:inline">Searching...</span>
                      </>
                    ) : (
                      <>
                        <i className="bx bx-search"></i>
                        <span className="hidden sm:inline">Search</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Found Student Info */}
              {foundStudent && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <i className="bx bx-check-circle text-green-600 dark:text-green-400 text-xl"></i>
                    <span className="font-semibold text-green-800 dark:text-green-300">Student Found</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    <strong>Name:</strong> {foundStudent.name}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    <strong>Reg Number:</strong> {foundStudent.reg_number}
                  </p>
                </div>
              )}

              {/* Generate Button */}
              {foundStudent && !generatedCode && (
                <button
                  onClick={handleGenerateAccess}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2 font-medium"
                >
                  {loading ? (
                    <>
                      <i className="bx bx-loader-alt animate-spin"></i>
                      <span>Generating Code...</span>
                    </>
                  ) : (
                    <>
                      <i className="bx bx-key"></i>
                      <span>Generate Access Code</span>
                    </>
                  )}
                </button>
              )}

              {/* Generated Code Display */}
              {generatedCode && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Access Code Generated</p>
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider text-center py-4">
                      {generatedCode.access_code}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 text-center mt-2">
                      Generated: {new Date(generatedCode.generated_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center space-x-2"
                      title="Print access code"
                    >
                      <i className="bx bx-printer"></i>
                      <span>Print Code</span>
                    </button>
                    <button
                      onClick={() => {
                        copyToClipboard(generatedCode.access_code);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center space-x-2"
                      title="Copy code"
                    >
                      <i className="bx bx-copy"></i>
                      <span>Copy</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setFoundStudent(null);
                      setGeneratedCode(null);
                      setRegNumber('');
                    }}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    title="Generate another code"
                  >
                    Generate Another Code
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Usage Instructions */}
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <i className="bx bx-info-circle text-blue-600 dark:text-blue-400 text-2xl flex-shrink-0"></i>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How to Use</h3>
                  <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-2 list-decimal list-inside">
                    <li>Select the exam from the dropdown</li>
                    <li>Enter student's registration number</li>
                    <li>Click "Search" to verify student exists</li>
                    <li>Click "Generate Access Code"</li>
                    <li>Click "Print Code" to print the ticket</li>
                    <li>Give printed code to the student</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <i className="bx bx-alert-triangle text-amber-600 dark:text-amber-400 text-2xl flex-shrink-0"></i>
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">Important</h3>
                  <ul className="text-sm text-amber-800 dark:text-amber-400 space-y-1 list-disc list-inside">
                    <li>Each code works only once</li>
                    <li>Codes expire at end of day</li>
                    <li>One student = one code per exam</li>
                    <li>Invalid reg numbers won't generate</li>
                    <li>Print immediately after generation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Generated Codes History
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
      </div>
    </div>
  );
};

export default ExamAccess;
