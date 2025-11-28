import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Input, Alert, Loading } from '../components';

type Tab = 'overview' | 'students' | 'exams' | 'subjects' | 'departments' | 'results';

interface Student {
  id: number;
  name: string;
  email: string;
  registration_number: string;
  class_level: string;
  department: string;
}

interface Exam {
  id: number;
  title: string;
  subject: string;
  class_level: string;
  duration_minutes: number;
  total_marks: number;
  status: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // Modal states
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/admin-login');
      return;
    }
    setUser(JSON.parse(userData));
    loadData();
  }, [navigate]);

  const loadData = () => {
    // Simulate loading data
    setStudents([
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        registration_number: 'REG/2024/001',
        class_level: 'JSS1',
        department: 'Science'
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        registration_number: 'REG/2024/002',
        class_level: 'JSS2',
        department: 'Arts'
      }
    ]);

    setExams([
      {
        id: 1,
        title: 'Mathematics Mid-Term',
        subject: 'Mathematics',
        class_level: 'JSS1',
        duration_minutes: 60,
        total_marks: 100,
        status: 'published'
      },
      {
        id: 2,
        title: 'English Assessment',
        subject: 'English',
        class_level: 'JSS2',
        duration_minutes: 45,
        total_marks: 50,
        status: 'draft'
      }
    ]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const renderOverview = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Students</p>
              <p className="text-3xl font-bold mt-2">{students.length}</p>
            </div>
            <svg className="w-12 h-12 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Exams</p>
              <p className="text-3xl font-bold mt-2">{exams.length}</p>
            </div>
            <svg className="w-12 h-12 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Active Exams</p>
              <p className="text-3xl font-bold mt-2">{exams.filter(e => e.status === 'published').length}</p>
            </div>
            <svg className="w-12 h-12 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Subjects</p>
              <p className="text-3xl font-bold mt-2">12</p>
            </div>
            <svg className="w-12 h-12 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 pb-3 border-b">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">New student registered</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-3 border-b">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Exam submitted by John Doe</p>
                <p className="text-xs text-gray-500">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">New exam created</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => setShowStudentModal(true)} fullWidth>
              Add Student
            </Button>
            <Button onClick={() => setShowExamModal(true)} variant="secondary" fullWidth>
              Create Exam
            </Button>
            <Button variant="outline" fullWidth>
              Export Data
            </Button>
            <Button variant="outline" fullWidth>
              System Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderStudents = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
        <div className="flex gap-3">
          <Button variant="secondary">Export CSV</Button>
          <Button onClick={() => setShowStudentModal(true)}>Add Student</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registration_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.class_level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderExams = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Exam Management</h2>
        <Button onClick={() => setShowExamModal(true)}>Create Exam</Button>
      </div>

      <div className="grid gap-4">
        {exams.map(exam => (
          <Card key={exam.id}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                  <span>Subject: {exam.subject}</span>
                  <span>Class: {exam.class_level}</span>
                  <span>Duration: {exam.duration_minutes} min</span>
                  <span>Marks: {exam.total_marks}</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    exam.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {exam.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary">Edit</Button>
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm" variant="danger">Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <Loading fullScreen message="Loading admin dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome, {user?.name || 'Administrator'}</p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <Alert type="success" message={success} onClose={() => setSuccess(null)} />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {(['overview', 'students', 'exams', 'subjects', 'departments', 'results'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'students' && renderStudents()}
        {activeTab === 'exams' && renderExams()}
        {activeTab === 'subjects' && <div className="text-center py-12 text-gray-500">Subjects management coming soon...</div>}
        {activeTab === 'departments' && <div className="text-center py-12 text-gray-500">Departments management coming soon...</div>}
        {activeTab === 'results' && <div className="text-center py-12 text-gray-500">Results management coming soon...</div>}
      </div>

      {/* Modals */}
      <Modal
        isOpen={showStudentModal}
        title="Add New Student"
        onClose={() => setShowStudentModal(false)}
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Full Name" type="text" fullWidth />
          <Input label="Email" type="email" fullWidth />
          <Input label="Registration Number" type="text" fullWidth />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Class Level</label>
              <select className="w-full px-4 py-2 border rounded-lg mt-2">
                <option>JSS1</option>
                <option>JSS2</option>
                <option>JSS3</option>
                <option>SSS1</option>
                <option>SSS2</option>
                <option>SSS3</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Department</label>
              <select className="w-full px-4 py-2 border rounded-lg mt-2">
                <option>Science</option>
                <option>Arts</option>
                <option>Commercial</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowStudentModal(false)}>Cancel</Button>
            <Button onClick={() => { setSuccess('Student added successfully!'); setShowStudentModal(false); }}>Add Student</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showExamModal}
        title="Create New Exam"
        onClose={() => setShowExamModal(false)}
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Exam Title" type="text" fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Duration (minutes)" type="number" fullWidth />
            <Input label="Total Marks" type="number" fullWidth />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <select className="w-full px-4 py-2 border rounded-lg mt-2">
                <option>Mathematics</option>
                <option>English</option>
                <option>Basic Science</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Class Level</label>
              <select className="w-full px-4 py-2 border rounded-lg mt-2">
                <option>JSS1</option>
                <option>JSS2</option>
                <option>JSS3</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowExamModal(false)}>Cancel</Button>
            <Button onClick={() => { setSuccess('Exam created successfully!'); setShowExamModal(false); }}>Create Exam</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
