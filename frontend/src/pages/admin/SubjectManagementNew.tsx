import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';

interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  class_level: string;
  is_active: boolean;
}

interface SchoolClass {
  id: number;
  name: string;
  code: string;
  department_id: number | null;
  description: string;
  capacity: number;
  is_active: boolean;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  class_id: number;
  department_id: number | null;
  subject_type: 'core' | 'elective';
  is_compulsory: boolean;
  class_level: string;
}

const SubjectManagementNew: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'departments' | 'classes' | 'subjects'>('departments');
  
  // Data states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Pagination states
  const [deptPage, setDeptPage] = useState(1);
  const [classPage, setClassPage] = useState(1);
  const [subjectPage, setSubjectPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  
  // Form states
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    class_level: 'SSS'
  });
  
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    department_id: '',
    description: '',
    capacity: 30,
    is_active: true
  });
  
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    description: '',
    class_id: '',
    department_id: '',
    subject_type: 'core' as 'core' | 'elective',
    is_compulsory: true
  });

  const [selectedClassForSubject, setSelectedClassForSubject] = useState<SchoolClass | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<Department[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    // Update selected class when class_id changes
    if (subjectForm.class_id) {
      const selectedClass = classes.find(c => c.id === Number(subjectForm.class_id));
      setSelectedClassForSubject(selectedClass || null);
      
      // Filter departments based on selected class
      if (selectedClass) {
        if (isSSClass(selectedClass.name)) {
          // For SSS classes, show only the department linked to this class
          if (selectedClass.department_id) {
            const classDept = departments.filter(d => d.id === selectedClass.department_id);
            setAvailableDepartments(classDept);
          } else {
            // If SSS class has no department, show all SSS departments
            setAvailableDepartments(departments.filter(d => d.class_level === 'SSS'));
          }
        } else {
          setAvailableDepartments([]);
          setSubjectForm(prev => ({ ...prev, department_id: '' }));
        }
      }
    } else {
      setSelectedClassForSubject(null);
      setAvailableDepartments([]);
    }
  }, [subjectForm.class_id, classes, departments]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [deptRes, classRes, subjectRes] = await Promise.all([
        api.get('/departments?limit=1000'),
        api.get('/classes?limit=1000'),
        api.get('/subjects?limit=1000'),
      ]);
      
      // Extract data from paginated response
      const deptData = deptRes.data.data || deptRes.data || [];
      const classData = classRes.data.data || classRes.data || [];
      const subjectData = subjectRes.data.data || subjectRes.data || [];
      
      console.log('Loaded data:', { 
        departments: deptData.length, 
        classes: classData.length, 
        subjects: subjectData.length 
      });
      
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const isSSClass = (className: string): boolean => {
    return className.toUpperCase().includes('SSS');
  };

  // Pagination helpers
  const getPaginatedData = <T,>(data: T[], page: number): T[] => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number): number => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const handlePageChange = (newPage: number, setPage: (page: number) => void, totalPages: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const getPageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    
    if (currentPage <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Department CRUD
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deptForm.name || !deptForm.code) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await api.post('/departments', deptForm);
      showSuccess('Department created successfully');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '', description: '', class_level: 'SSS' });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to create department');
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this department? This will affect all related classes and subjects.');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/departments/${id}`);
        showSuccess('Department deleted successfully');
        loadAllData();
      } catch (error) {
        showError('Failed to delete department');
      }
    }
  };

  // Class CRUD
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!classForm.name || !classForm.code) {
      showError('Please fill in all required fields');
      return;
    }

    // Validate department requirement for SSS classes
    if (isSSClass(classForm.name) && !classForm.department_id) {
      showError('Department is required for SSS classes');
      return;
    }

    try {
      const payload = {
        ...classForm,
        department_id: classForm.department_id || null
      };
      
      await api.post('/classes', payload);
      showSuccess('Class created successfully');
      setShowClassModal(false);
      setClassForm({
        name: '',
        code: '',
        department_id: '',
        description: '',
        capacity: 30,
        is_active: true
      });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to create class');
    }
  };

  const handleDeleteClass = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this class? This will affect all students and subjects in this class.');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/classes/${id}`);
        showSuccess('Class deleted successfully');
        loadAllData();
      } catch (error) {
        showError('Failed to delete class');
      }
    }
  };

  // Subject CRUD
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subjectForm.name || !subjectForm.code || !subjectForm.class_id) {
      showError('Please fill in all required fields');
      return;
    }

    // Validate department requirement for SSS classes
    if (selectedClassForSubject && isSSClass(selectedClassForSubject.name) && !subjectForm.department_id) {
      showError('Department is required for SSS class subjects');
      return;
    }

    try {
      const payload = {
        ...subjectForm,
        department_id: subjectForm.department_id || null,
        is_compulsory: subjectForm.subject_type === 'core'
      };
      
      await api.post('/subjects', payload);
      showSuccess('Subject created successfully');
      setShowSubjectModal(false);
      setSubjectForm({
        name: '',
        code: '',
        description: '',
        class_id: '',
        department_id: '',
        subject_type: 'core',
        is_compulsory: true
      });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to create subject');
    }
  };

  const handleDeleteSubject = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this subject?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/subjects/${id}`);
        showSuccess('Subject deleted successfully');
        loadAllData();
      } catch (error) {
        showError('Failed to delete subject');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className='bx bx-loader-alt bx-spin text-5xl text-blue-600'></i>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Academic Management
          </h1>
          <p className="text-gray-600 text-sm mt-1">Manage departments, classes, and subjects</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md p-1.5 mb-4">
          <div className="flex gap-1.5">
            {(['departments', 'classes', 'subjects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 text-sm ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i className={`bx ${
                  tab === 'departments' ? 'bx-building' : 
                  tab === 'classes' ? 'bx-group' : 
                  'bx-book'
                } mr-1 text-base`}></i>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Departments</h2>
                <p className="text-xs text-gray-600">Required for SSS classes • {departments.length} total</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setDeptPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button
                  onClick={() => setShowDeptModal(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-md hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-sm"
                >
                  <i className='bx bx-plus-circle text-lg'></i>
                  Add Department
                </button>
              </div>
            </div>

            {departments.length === 0 ? (
              <div className="text-center py-8">
                <i className='bx bx-building text-5xl text-gray-300 mb-3'></i>
                <p className="text-gray-500">No departments yet</p>
                <p className="text-gray-400 text-xs mt-1">Create a department to get started</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {getPaginatedData(departments, deptPage).map((dept) => (
                    <div key={dept.id} className="border border-gray-200 rounded-md p-3 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-800">{dept.name}</h3>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {dept.class_level}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              dept.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {dept.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">Code: {dept.code}</p>
                          {dept.description && (
                            <p className="text-xs text-gray-500 mt-1">{dept.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                        >
                        <i className='bx bx-trash text-lg'></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination for Departments */}
              {getTotalPages(departments.length) > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-xs text-gray-600">
                    Showing {((deptPage - 1) * itemsPerPage) + 1} to {Math.min(deptPage * itemsPerPage, departments.length)} of {departments.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(deptPage - 1, setDeptPage, getTotalPages(departments.length))}
                      disabled={deptPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-left'></i>
                    </button>
                    {getPageNumbers(deptPage, getTotalPages(departments.length)).map((page, idx) => (
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setDeptPage(page as number)}
                          className={`px-3 py-1 border rounded-md text-xs ${
                            page === deptPage
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    <button
                      onClick={() => handlePageChange(deptPage + 1, setDeptPage, getTotalPages(departments.length))}
                      disabled={deptPage === getTotalPages(departments.length)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-right'></i>
                    </button>
                  </div>
                </div>
              )}
            </>
            )}
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Classes</h2>
                <p className="text-xs text-gray-600">
                  {departments.length === 0 
                    ? '⚠️ Create departments first for SSS classes' 
                    : `SSS classes must be linked to a department • ${classes.length} total`
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setClassPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button
                  onClick={() => setShowClassModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-md hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-sm"
                >
                  <i className='bx bx-plus-circle text-lg'></i>
                  Add Class
                </button>
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-8">
                <i className='bx bx-group text-5xl text-gray-300 mb-3'></i>
                <p className="text-gray-500">No classes yet</p>
                <p className="text-gray-400 text-xs mt-1">Create a class to get started</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {getPaginatedData(classes, classPage).map((cls) => (
                    <div key={cls.id} className="border border-gray-200 rounded-md p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-800">{cls.name}</h3>
                          {isSSClass(cls.name) && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              SSS
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            cls.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {cls.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">Code: {cls.code}</p>
                        {cls.department_id && (
                          <p className="text-xs text-gray-600">
                            Dept: {departments.find(d => d.id === cls.department_id)?.name || 'N/A'}
                          </p>
                        )}
                        <p className="text-xs text-gray-600">Capacity: {cls.capacity}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteClass(cls.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      >
                        <i className='bx bx-trash text-lg'></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination for Classes */}
              {getTotalPages(classes.length) > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-xs text-gray-600">
                    Showing {((classPage - 1) * itemsPerPage) + 1} to {Math.min(classPage * itemsPerPage, classes.length)} of {classes.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(classPage - 1, setClassPage, getTotalPages(classes.length))}
                      disabled={classPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-left'></i>
                    </button>
                    {getPageNumbers(classPage, getTotalPages(classes.length)).map((page, idx) => (
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setClassPage(page as number)}
                          className={`px-3 py-1 border rounded-md text-xs ${
                            page === classPage
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    <button
                      onClick={() => handlePageChange(classPage + 1, setClassPage, getTotalPages(classes.length))}
                      disabled={classPage === getTotalPages(classes.length)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-right'></i>
                    </button>
                  </div>
                </div>
              )}
            </>
            )}
          </div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Subjects</h2>
                <p className="text-xs text-gray-600">
                  {classes.length === 0 
                    ? '⚠️ Create classes first' 
                    : `Core subjects are compulsory, electives are optional • ${subjects.length} total`
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setSubjectPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button
                  onClick={() => setShowSubjectModal(true)}
                  disabled={classes.length === 0}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-md hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className='bx bx-plus-circle text-lg'></i>
                  Add Subject
                </button>
              </div>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-8">
                <i className='bx bx-book text-5xl text-gray-300 mb-3'></i>
                <p className="text-gray-500">No subjects yet</p>
                <p className="text-gray-400 text-xs mt-1">Create a subject to get started</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {getPaginatedData(subjects, subjectPage).map((subject) => (
                    <div key={subject.id} className="border border-gray-200 rounded-md p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-800">{subject.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            subject.subject_type === 'core' 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {subject.subject_type === 'core' ? 'Core' : 'Elective'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">Code: {subject.code}</p>
                        <p className="text-xs text-gray-600">
                          Class: {classes.find(c => c.id === subject.class_id)?.name || 'N/A'}
                        </p>
                        {subject.department_id && (
                          <p className="text-xs text-gray-600">
                            Dept: {departments.find(d => d.id === subject.department_id)?.name || 'N/A'}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      >
                        <i className='bx bx-trash text-lg'></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination for Subjects */}
              {getTotalPages(subjects.length) > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-xs text-gray-600">
                    Showing {((subjectPage - 1) * itemsPerPage) + 1} to {Math.min(subjectPage * itemsPerPage, subjects.length)} of {subjects.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(subjectPage - 1, setSubjectPage, getTotalPages(subjects.length))}
                      disabled={subjectPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-left'></i>
                    </button>
                    {getPageNumbers(subjectPage, getTotalPages(subjects.length)).map((page, idx) => (
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setSubjectPage(page as number)}
                          className={`px-3 py-1 border rounded-md text-xs ${
                            page === subjectPage
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    <button
                      onClick={() => handlePageChange(subjectPage + 1, setSubjectPage, getTotalPages(subjects.length))}
                      disabled={subjectPage === getTotalPages(subjects.length)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <i className='bx bx-chevron-right'></i>
                    </button>
                  </div>
                </div>
              )}
            </>
            )}
          </div>
        )}

        {/* Department Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Create Department</h3>
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <i className='bx bx-x'></i>
                </button>
              </div>
              
              <form onSubmit={handleCreateDepartment} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., Science, Art, Commercial"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., SCI, ART, COM"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Class Level
                  </label>
                  <select
                    value={deptForm.class_level}
                    onChange={(e) => setDeptForm({ ...deptForm, class_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="SSS">SSS (Senior Secondary)</option>
                    <option value="JSS">JSS (Junior Secondary)</option>
                    <option value="Primary">Primary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:shadow-md font-medium text-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Class Modal */}
        {showClassModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Create Class</h3>
                <button
                  onClick={() => setShowClassModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <i className='bx bx-x'></i>
                </button>
              </div>
              
              <form onSubmit={handleCreateClass} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., SSS 1, JSS 2, Primary 4"
                    required
                  />
                  {isSSClass(classForm.name) && (
                    <p className="text-xs text-purple-600 mt-1">
                      <i className='bx bx-info-circle'></i> This is an SSS class - department is required
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Class Code *
                  </label>
                  <input
                    type="text"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., SSS1, JSS2, PRI4"
                    required
                  />
                </div>

                {isSSClass(classForm.name) && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Department * <span className="text-purple-600">(Required)</span>
                    </label>
                    {departments.length === 0 ? (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-xs text-yellow-800">
                          <i className='bx bx-error-circle mr-1'></i>
                          No departments available. Please create a department first.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={classForm.department_id}
                        onChange={(e) => setClassForm({ ...classForm, department_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required={isSSClass(classForm.name)}
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="1"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowClassModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:shadow-md font-medium text-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subject Modal */}
        {showSubjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Create Subject</h3>
                <button
                  onClick={() => setShowSubjectModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <i className='bx bx-x'></i>
                </button>
              </div>
              
              <form onSubmit={handleCreateSubject} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="e.g., Mathematics, English, Biology"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="e.g., MATH, ENG, BIO"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Class *
                  </label>
                  {classes.length === 0 ? (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs text-yellow-800">
                        <i className='bx bx-error-circle mr-1'></i>
                        No classes available. Please create a class first.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={subjectForm.class_id}
                      onChange={(e) => setSubjectForm({ ...subjectForm, class_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      required
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedClassForSubject && isSSClass(selectedClassForSubject.name) && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Department * <span className="text-purple-600">(Required)</span>
                    </label>
                    {availableDepartments.length === 0 ? (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-xs text-yellow-800">
                          <i className='bx bx-error-circle mr-1'></i>
                          No departments available. Please create a department first.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={subjectForm.department_id}
                        onChange={(e) => setSubjectForm({ ...subjectForm, department_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        required
                      >
                        <option value="">Select Department</option>
                        {availableDepartments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSubjectForm({ ...subjectForm, subject_type: 'core', is_compulsory: true })}
                      className={`px-3 py-2 rounded-md border-2 font-medium transition-all text-sm ${
                        subjectForm.subject_type === 'core'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 text-gray-700 hover:border-orange-300'
                      }`}
                    >
                      <i className='bx bx-star mr-1'></i>
                      Core
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectForm({ ...subjectForm, subject_type: 'elective', is_compulsory: false })}
                      className={`px-3 py-2 rounded-md border-2 font-medium transition-all text-sm ${
                        subjectForm.subject_type === 'elective'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <i className='bx bx-list-check mr-1'></i>
                      Elective
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {subjectForm.subject_type === 'core' 
                      ? 'Core subjects are compulsory for all students'
                      : 'Elective subjects are optional'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={subjectForm.description}
                    onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSubjectModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-md hover:shadow-md font-medium text-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectManagementNew;
