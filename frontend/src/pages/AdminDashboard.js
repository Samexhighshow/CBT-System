import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import laravelApi from '../services/laravelApi';
import { Button, Modal, Input, Card, Loading } from '../components';
import { showSuccess, showError, showDeleteConfirm, showToast } from '../utils/alerts';

const AdminDashboard = () => {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [registrationWindows, setRegistrationWindows] = useState([]);

  // Modal states
  const [showExamModal, setShowExamModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showWindowModal, setShowWindowModal] = useState(false);

  // Form states
  const [examForm, setExamForm] = useState({ title: '', class_level: 'JSS', duration_minutes: 60 });
  const [departmentForm, setDepartmentForm] = useState({ name: '', class_level: 'JSS', is_active: true });
  const [subjectForm, setSubjectForm] = useState({ name: '', class_level: 'JSS' });
  const [windowForm, setWindowForm] = useState({ start_at: '', end_at: '' });

  // Fetch data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [examsRes, studentsRes, deptRes, subjRes, windowRes] = await Promise.all([
        laravelApi.get('/exams'),
        laravelApi.get('/students'),
        laravelApi.get('/departments'),
        laravelApi.get('/subjects'),
        laravelApi.get('/registration-windows')
      ]);

      setExams(examsRes?.data?.exams || []);
      setStudents(studentsRes?.data?.students || []);
      setDepartments(deptRes?.data?.departments || []);
      setSubjects(subjRes?.data?.subjects || []);
      setRegistrationWindows(windowRes?.data?.windows || []);
    } catch (err) {
      showError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async () => {
    try {
      const response = await laravelApi.post('/exams', examForm);
      setExams([...exams, response.data]);
      setShowExamModal(false);
      setExamForm({ title: '', class_level: 'JSS', duration_minutes: 60 });
      showToast('Exam created successfully!', 'success');
    } catch (err) {
      showError('Failed to create exam. Please try again.');
    }
  };

  const handleCreateDepartment = async () => {
    try {
      const response = await laravelApi.post('/departments', departmentForm);
      setDepartments([...departments, response.data]);
      setShowDepartmentModal(false);
      setDepartmentForm({ name: '', class_level: 'JSS', is_active: true });
      showToast('Department created successfully!', 'success');
    } catch (err) {
      showError('Failed to create department. Please try again.');
    }
  };

  const handleCreateSubject = async () => {
    try {
      const response = await laravelApi.post('/subjects', subjectForm);
      setSubjects([...subjects, response.data]);
      setShowSubjectModal(false);
      setSubjectForm({ name: '', class_level: 'JSS' });
      showToast('Subject created successfully!', 'success');
    } catch (err) {
      showError('Failed to create subject. Please try again.');
    }
  };

  const handleCreateWindow = async () => {
    try {
      const response = await laravelApi.post('/registration-windows', windowForm);
      setRegistrationWindows([...registrationWindows, response.data]);
      setShowWindowModal(false);
      setWindowForm({ start_at: '', end_at: '' });
      showToast('Registration window created successfully!', 'success');
    } catch (err) {
      showError('Failed to create registration window. Please try again.');
    }
  };

  const handleExportCSV = async (type) => {
    try {
      const endpoint = `/export/${type}`;
      const response = await laravelApi.get(endpoint);
      
      const link = document.createElement('a');
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(response.data)}`;
      link.download = `${type}_export.csv`;
      link.click();
      
      showToast(`${type} exported successfully!`, 'success');
    } catch (err) {
      showError(`Failed to export ${type}. Please try again.`);
    }
  };

  if (loading && activeTab === 'overview') {
    return <Loading fullScreen message="Loading admin dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-full mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome, {user?.name || 'Admin'}</p>
          </div>
          <Button variant="danger" onClick={logout}>
            <i className='bx bx-log-out mr-2'></i>
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          {['overview', 'exams', 'students', 'departments', 'subjects', 'windows', 'reports'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Exams</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{exams.length}</p>
                  </div>
                  <div className="bg-blue-100 p-4 rounded-full">
                    <i className='bx bx-book-open text-4xl text-blue-600'></i>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Students</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{students.length}</p>
                  </div>
                  <div className="bg-green-100 p-4 rounded-full">
                    <i className='bx bx-user-circle text-4xl text-green-600'></i>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Departments</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{departments.length}</p>
                  </div>
                  <div className="bg-purple-100 p-4 rounded-full">
                    <i className='bx bx-buildings text-4xl text-purple-600'></i>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Registration Windows</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{registrationWindows.length}</p>
                  </div>
                  <div className="bg-orange-100 p-4 rounded-full">
                    <i className='bx bx-calendar-check text-4xl text-orange-600'></i>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <i className='bx bx-book-open text-2xl mr-2 text-blue-600'></i>
                  Manage Exams
                </h2>
                <Button onClick={() => setShowExamModal(true)}>
                  <i className='bx bx-plus mr-1'></i>
                  New Exam
                </Button>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Class Level</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Published</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map(exam => (
                      <tr key={exam.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{exam.title}</td>
                        <td className="px-6 py-4 text-sm">{exam.class_level}</td>
                        <td className="px-6 py-4 text-sm">{exam.duration_minutes} mins</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            exam.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {exam.published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Button size="sm" variant="secondary">Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <i className='bx bx-user-circle text-2xl mr-2 text-green-600'></i>
                Student Registrations
              </h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Student ID</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Class Level</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium">{student.student_id}</td>
                        <td className="px-6 py-4 text-sm">{student.first_name} {student.last_name}</td>
                        <td className="px-6 py-4 text-sm">{student.email}</td>
                        <td className="px-6 py-4 text-sm">{student.class_level}</td>
                        <td className="px-6 py-4 text-sm">{new Date(student.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <i className='bx bx-buildings text-2xl mr-2 text-purple-600'></i>
                  Departments
                </h2>
                <Button onClick={() => setShowDepartmentModal(true)}>
                  <i className='bx bx-plus mr-1'></i>
                  New Department
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(dept => (
                  <Card key={dept.id} title={dept.name} subtitle={`Class: ${dept.class_level}`}>
                    <p className="text-sm text-gray-600 mb-2">{dept.description}</p>
                    <p className="text-xs text-gray-500">
                      {dept.is_active ? '✓ Active' : '✗ Inactive'}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <i className='bx bx-book-alt text-2xl mr-2 text-indigo-600'></i>
                  Subjects
                </h2>
                <Button onClick={() => setShowSubjectModal(true)}>
                  <i className='bx bx-plus mr-1'></i>
                  New Subject
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map(subject => (
                  <Card key={subject.id} title={subject.name} subtitle={`Class: ${subject.class_level}`}>
                    <p className="text-sm text-gray-600">
                      Compulsory: {subject.is_compulsory ? 'Yes' : 'No'}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Registration Windows Tab */}
          {activeTab === 'windows' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <i className='bx bx-calendar-check text-2xl mr-2 text-orange-600'></i>
                  Registration Windows
                </h2>
                <Button onClick={() => setShowWindowModal(true)}>
                  <i className='bx bx-plus mr-1'></i>
                  New Window
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {registrationWindows.map(window => (
                  <Card key={window.id} title="Registration Window">
                    <p className="text-sm text-gray-600">
                      From: {new Date(window.start_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      To: {new Date(window.end_at).toLocaleString()}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <i className='bx bx-bar-chart text-2xl mr-2 text-teal-600'></i>
                Export Reports
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card title="Student List">
                  <Button fullWidth onClick={() => handleExportCSV('students')}>
                    <i className='bx bx-download mr-2'></i>
                    Download CSV
                  </Button>
                </Card>
                <Card title="Exam List">
                  <Button fullWidth onClick={() => handleExportCSV('exams')}>
                    <i className='bx bx-download mr-2'></i>
                    Download CSV
                  </Button>
                </Card>
                <Card title="Results Summary">
                  <Button fullWidth onClick={() => handleExportCSV('results')}>
                    <i className='bx bx-download mr-2'></i>
                    Download CSV
                  </Button>
                </Card>
                <Card title="Department Report">
                  <Button fullWidth onClick={() => handleExportCSV('departments')}>
                    <i className='bx bx-download mr-2'></i>
                    Download CSV
                  </Button>
                </Card>
                <Card title="Performance Analytics">
                  <Button fullWidth onClick={() => handleExportCSV('analytics')}>
                    <i className='bx bx-download mr-2'></i>
                    Download CSV
                  </Button>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showExamModal}
        title="Create New Exam"
        onClose={() => setShowExamModal(false)}
        onConfirm={handleCreateExam}
        confirmText="Create"
      >
        <div className="space-y-4">
          <Input
            label="Exam Title"
            value={examForm.title}
            onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
            placeholder="e.g., Mathematics Final Exam"
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Level</label>
            <select
              value={examForm.class_level}
              onChange={(e) => setExamForm({ ...examForm, class_level: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>JSS</option>
              <option>SSS</option>
            </select>
          </div>
          <Input
            label="Duration (minutes)"
            type="number"
            value={examForm.duration_minutes}
            onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) })}
            fullWidth
          />
        </div>
      </Modal>

      <Modal
        isOpen={showDepartmentModal}
        title="Create New Department"
        onClose={() => setShowDepartmentModal(false)}
        onConfirm={handleCreateDepartment}
        confirmText="Create"
      >
        <div className="space-y-4">
          <Input
            label="Department Name"
            value={departmentForm.name}
            onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
            placeholder="e.g., Science"
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Level</label>
            <select
              value={departmentForm.class_level}
              onChange={(e) => setDepartmentForm({ ...departmentForm, class_level: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>JSS</option>
              <option>SSS</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSubjectModal}
        title="Create New Subject"
        onClose={() => setShowSubjectModal(false)}
        onConfirm={handleCreateSubject}
        confirmText="Create"
      >
        <div className="space-y-4">
          <Input
            label="Subject Name"
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            placeholder="e.g., English Language"
            fullWidth
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Level</label>
            <select
              value={subjectForm.class_level}
              onChange={(e) => setSubjectForm({ ...subjectForm, class_level: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>JSS</option>
              <option>SSS</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showWindowModal}
        title="Create Registration Window"
        onClose={() => setShowWindowModal(false)}
        onConfirm={handleCreateWindow}
        confirmText="Create"
      >
        <div className="space-y-4">
          <Input
            label="Start Date & Time"
            type="datetime-local"
            value={windowForm.start_at}
            onChange={(e) => setWindowForm({ ...windowForm, start_at: e.target.value })}
            fullWidth
          />
          <Input
            label="End Date & Time"
            type="datetime-local"
            value={windowForm.end_at}
            onChange={(e) => setWindowForm({ ...windowForm, end_at: e.target.value })}
            fullWidth
          />
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
