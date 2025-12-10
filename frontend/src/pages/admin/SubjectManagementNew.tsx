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
  
  // Selection states for bulk operations
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  
  // Edit states
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  
  // Upload states
  const [uploadModal, setUploadModal] = useState<'departments' | 'classes' | 'subjects' | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, deptForm);
        showSuccess('Department updated successfully');
      } else {
        await api.post('/departments', deptForm);
        showSuccess('Department created successfully');
      }
      setShowDeptModal(false);
      setEditingDept(null);
      setDeptForm({ name: '', code: '', description: '', class_level: 'SSS' });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save department');
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
    
    if (!classForm.name) {
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
      if (editingClass) {
        await api.put(`/classes/${editingClass.id}`, payload);
        showSuccess('Class updated successfully');
      } else {
        await api.post('/classes', payload);
        showSuccess('Class created successfully');
      }
      setShowClassModal(false);
      setEditingClass(null);
      setClassForm({
        name: '',
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
      
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, payload);
        showSuccess('Subject updated successfully');
      } else {
        await api.post('/subjects', payload);
        showSuccess('Subject created successfully');
      }
      setShowSubjectModal(false);
      setEditingSubject(null);
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

  // Bulk Delete Handlers
  const handleBulkDeleteDepts = async () => {
    if (selectedDepts.length === 0) {
      showError('No departments selected');
      return;
    }
    const confirmed = await showDeleteConfirm(`Delete ${selectedDepts.length} department(s)?`);
    if (confirmed.isConfirmed) {
      try {
        await api.post('/departments/bulk-delete', { ids: selectedDepts });
        showSuccess(`${selectedDepts.length} department(s) deleted successfully`);
        setSelectedDepts([]);
        loadAllData();
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to delete departments');
      }
    }
  };

  const handleBulkDeleteClasses = async () => {
    if (selectedClasses.length === 0) {
      showError('No classes selected');
      return;
    }
    const confirmed = await showDeleteConfirm(`Delete ${selectedClasses.length} class(es)?`);
    if (confirmed.isConfirmed) {
      try {
        await api.post('/classes/bulk-delete', { ids: selectedClasses });
        showSuccess(`${selectedClasses.length} class(es) deleted successfully`);
        setSelectedClasses([]);
        loadAllData();
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to delete classes');
      }
    }
  };

  const handleBulkDeleteSubjects = async () => {
    if (selectedSubjects.length === 0) {
      showError('No subjects selected');
      return;
    }
    const confirmed = await showDeleteConfirm(`Delete ${selectedSubjects.length} subject(s)?`);
    if (confirmed.isConfirmed) {
      try {
        await api.post('/subjects/bulk-delete', { ids: selectedSubjects });
        showSuccess(`${selectedSubjects.length} subject(s) deleted successfully`);
        setSelectedSubjects([]);
        loadAllData();
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to delete subjects');
      }
    }
  };

  // Edit Handlers
  const handleEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      class_level: dept.class_level
    });
    setShowDeptModal(true);
  };

  const handleEditClass = (cls: SchoolClass) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      department_id: cls.department_id?.toString() || '',
      description: cls.description,
      capacity: cls.capacity,
      is_active: cls.is_active
    });
    setShowClassModal(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      description: subject.description,
      class_id: subject.class_id?.toString() || '',
      department_id: subject.department_id?.toString() || '',
      subject_type: subject.subject_type,
      is_compulsory: subject.is_compulsory
    });
    setShowSubjectModal(true);
  };

  // Update handlers for edit mode
  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;

    if (!deptForm.name || !deptForm.code) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await api.put(`/departments/${editingDept.id}`, deptForm);
      showSuccess('Department updated successfully');
      setShowDeptModal(false);
      setEditingDept(null);
      setDeptForm({ name: '', code: '', description: '', class_level: 'SSS' });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update department');
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    if (!classForm.name) {
      showError('Please fill in all required fields');
      return;
    }

    if (isSSClass(classForm.name) && !classForm.department_id) {
      showError('Department is required for SSS classes');
      return;
    }

    try {
      const payload = {
        ...classForm,
        department_id: classForm.department_id || null
      };
      await api.put(`/classes/${editingClass.id}`, payload);
      showSuccess('Class updated successfully');
      setShowClassModal(false);
      setEditingClass(null);
      setClassForm({ name: '', department_id: '', description: '', capacity: 30, is_active: true });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update class');
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;

    if (!subjectForm.name || !subjectForm.code || !subjectForm.class_id) {
      showError('Please fill in all required fields');
      return;
    }

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
      await api.put(`/subjects/${editingSubject.id}`, payload);
      showSuccess('Subject updated successfully');
      setShowSubjectModal(false);
      setEditingSubject(null);
      setSubjectForm({ name: '', code: '', description: '', class_id: '', department_id: '', subject_type: 'core', is_compulsory: true });
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update subject');
    }
  };

  // Close modal handlers
  const closeModals = () => {
    setShowDeptModal(false);
    setShowClassModal(false);
    setShowSubjectModal(false);
    setEditingDept(null);
    setEditingClass(null);
    setEditingSubject(null);
  };

  // Select All handlers
  const handleSelectAllDepts = () => {
    if (selectedDepts.length === departments.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts(departments.map(d => d.id));
    }
  };

  const handleSelectAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  const handleSelectAllSubjects = () => {
    if (selectedSubjects.length === subjects.length) {
      setSelectedSubjects([]);
    } else {
      setSelectedSubjects(subjects.map(s => s.id));
    }
  };

  // Export handlers
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      showError('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showSuccess('Exported successfully');
  };

  const handleExportDepts = () => {
    exportToCSV(selectedDepts.length > 0 ? departments.filter(d => selectedDepts.includes(d.id)) : departments, 'departments');
  };

  const handleExportClasses = () => {
    exportToCSV(selectedClasses.length > 0 ? classes.filter(c => selectedClasses.includes(c.id)) : classes, 'classes');
  };

  const handleExportSubjects = () => {
    exportToCSV(selectedSubjects.length > 0 ? subjects.filter(s => selectedSubjects.includes(s.id)) : subjects, 'subjects');
  };

  // Bulk upload handler
  const handleBulkUpload = async (type: 'departments' | 'classes' | 'subjects') => {
    if (!uploadFile) {
      showError('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const endpoint = type === 'departments' ? '/departments/bulk-upload' :
                      type === 'classes' ? '/classes/bulk-upload' :
                      '/subjects/bulk-upload';
      
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      showSuccess(`${response.data.inserted || 0} items imported successfully`);
      setUploadModal(null);
      setUploadFile(null);
      loadAllData();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Upload failed. Please check your CSV format');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSampleCSV = (type: 'departments' | 'classes' | 'subjects') => {
    let csvContent = '';
    let filename = '';
    
    if (type === 'departments') {
      csvContent = 'name,code,description,class_level,is_active\n' +
                   'Science,SCI,Science Department,SSS,1\n' +
                   'Art & Humanity,ART,Arts Department,SSS,1';
      filename = 'departments-sample-template.csv';
    } else if (type === 'classes') {
      csvContent = 'name,department_id,description,capacity,is_active\n' +
                   'SSS 1,1,Senior Secondary School 1,30,1\n' +
                   'SSS 2,1,Senior Secondary School 2,30,1';
      filename = 'classes-sample-template.csv';
    } else if (type === 'subjects') {
      csvContent = 'name,code,class_id,subject_type,department_id,description\n' +
                   'Mathematics,MATH101,1,core,1,Core Mathematics\n' +
                   'English Language,ENG101,1,core,1,Compulsory English';
      filename = 'subjects-sample-template.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="app-shell section-shell py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Academic Management
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Manage departments, classes, and subjects</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md p-1.5 mb-3">
          <div className="flex gap-1.5">
            {(['departments', 'classes', 'subjects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all duration-200 text-xs md:text-sm ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i className={`bx ${
                  tab === 'departments' ? 'bx-building' : 
                  tab === 'classes' ? 'bx-group' : 
                  'bx-book'
                } mr-1 text-sm md:text-base`}></i>
                <span className="hidden md:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <div>
            {/* Header Section */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Departments</h2>
                  <p className="text-sm text-gray-600">
                    Required for SSS classes • {departments.length} total
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value="departments"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="departments">Select Department</option>
                  </select>
                  <button
                    onClick={() => handleExportDepts()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <i className='bx bx-download'></i>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Upload CSV Card */}
              <div 
                onClick={() => setUploadModal('departments')}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-gray-400">
                    <i className='bx bx-file'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Upload CSV File</h3>
                <p className="text-sm text-gray-600">Bulk upload departments from CSV</p>
              </div>

              {/* Upload Excel Card */}
              <div 
                onClick={() => handleDownloadSampleCSV('departments')}
                className="border-2 border-dashed border-green-500 rounded-lg p-8 text-center cursor-pointer hover:border-green-600 hover:bg-green-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-green-500">
                    <i className='bx bx-download'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Download Sample CSV</h3>
                <p className="text-sm text-gray-600">Download CSV format template</p>
              </div>

              {/* Manual Entry Card */}
              <div 
                onClick={() => setShowDeptModal(true)}
                className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-purple-500">
                    <i className='bx bx-edit'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Manual Entry</h3>
                <p className="text-sm text-gray-600">Add departments one by one</p>
              </div>
            </div>

            {/* Departments List Section */}
            {departments.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Your Departments</h3>
                    <p className="text-xs text-gray-600">{departments.length} total departments</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setDeptPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                    </select>
                  </div>
                </div>

                {/* Selection Bar */}
                <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedDepts.length > 0 && selectedDepts.length === departments.length}
                        onChange={handleSelectAllDepts}
                        className="w-5 h-5 cursor-pointer"
                        title="Select all departments"
                      />
                      <span className="text-sm font-semibold text-blue-800">
                        {selectedDepts.length > 0 ? `${selectedDepts.length} of ${departments.length} selected` : 'Select All'}
                      </span>
                    </div>
                    {selectedDepts.length > 0 && (
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button
                          onClick={handleExportDepts}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                        >
                          <i className='bx bx-download text-sm'></i>Export
                        </button>
                        <button
                          onClick={handleBulkDeleteDepts}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                        >
                          <i className='bx bx-trash text-sm'></i>Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Departments Grid */}
                <div className="grid gap-3">
                  {getPaginatedData(departments, deptPage).map((dept) => (
                    <div key={dept.id} className={`border rounded-md p-3 hover:shadow-sm transition-shadow ${selectedDepts.includes(dept.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedDepts.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDepts([...selectedDepts, dept.id]);
                            } else {
                              setSelectedDepts(selectedDepts.filter(id => id !== dept.id));
                            }
                          }}
                          className="mt-1 w-4 h-4 cursor-pointer"
                        />
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
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditDept(dept)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                            title="Edit"
                          >
                            <i className='bx bx-edit text-lg'></i>
                          </button>
                          <button
                            onClick={() => handleDeleteDepartment(dept.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            title="Delete"
                          >
                            <i className='bx bx-trash text-lg'></i>
                          </button>
                        </div>
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
              </div>
            )}
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div>
            {/* Header Section */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Classes</h2>
                  <p className="text-sm text-gray-600">
                    {departments.length === 0 
                      ? '⚠️ Create departments first for SSS classes' 
                      : `SSS classes must be linked to a department • ${classes.length} total`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value="classes"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="classes">Select Class</option>
                  </select>
                  <button
                    onClick={() => handleExportClasses()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <i className='bx bx-download'></i>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Upload CSV Card */}
              <div 
                onClick={() => setUploadModal('classes')}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-gray-400">
                    <i className='bx bx-file'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Upload CSV File</h3>
                <p className="text-sm text-gray-600">Bulk upload classes from CSV</p>
              </div>

              {/* Upload Excel Card */}
              <div 
                onClick={() => handleDownloadSampleCSV('classes')}
                className="border-2 border-dashed border-green-500 rounded-lg p-8 text-center cursor-pointer hover:border-green-600 hover:bg-green-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-green-500">
                    <i className='bx bx-download'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Download Sample CSV</h3>
                <p className="text-sm text-gray-600">Download CSV format template</p>
              </div>

              {/* Manual Entry Card */}
              <div 
                onClick={() => setShowClassModal(true)}
                className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-purple-500">
                    <i className='bx bx-edit'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Manual Entry</h3>
                <p className="text-sm text-gray-600">Add classes one by one</p>
              </div>
            </div>

            {/* Classes List Section */}
            {classes.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Your Classes</h3>
                    <p className="text-xs text-gray-600">{classes.length} total classes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setClassPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                    </select>
                  </div>
                </div>

                {/* Selection Bar */}
                <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedClasses.length > 0 && selectedClasses.length === classes.length}
                        onChange={handleSelectAllClasses}
                        className="w-5 h-5 cursor-pointer"
                        title="Select all classes"
                      />
                      <span className="text-sm font-semibold text-blue-800">
                        {selectedClasses.length > 0 ? `${selectedClasses.length} of ${classes.length} selected` : 'Select All'}
                      </span>
                    </div>
                    {selectedClasses.length > 0 && (
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button
                          onClick={handleExportClasses}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                        >
                          <i className='bx bx-download text-sm'></i>Export
                        </button>
                        <button
                          onClick={handleBulkDeleteClasses}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                        >
                          <i className='bx bx-trash text-sm'></i>Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Classes Grid */}
                <div className="grid gap-3">
                  {getPaginatedData(classes, classPage).map((cls) => (
                    <div key={cls.id} className={`border rounded-md p-3 hover:shadow-sm transition-shadow ${selectedClasses.includes(cls.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClasses([...selectedClasses, cls.id]);
                            } else {
                              setSelectedClasses(selectedClasses.filter(id => id !== cls.id));
                            }
                          }}
                          className="mt-1 w-4 h-4 cursor-pointer"
                        />
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
                          {cls.department_id && (
                            <p className="text-xs text-gray-600">
                              Dept: {departments.find(d => d.id === cls.department_id)?.name || 'N/A'}
                            </p>
                          )}
                          <p className="text-xs text-gray-600">Capacity: {cls.capacity}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditClass(cls)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                            title="Edit"
                          >
                            <i className='bx bx-edit text-lg'></i>
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            title="Delete"
                          >
                            <i className='bx bx-trash text-lg'></i>
                          </button>
                        </div>
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
              </div>
            )}
          </div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div>
            {/* Header Section */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Questions</h2>
                  <p className="text-sm text-gray-600">
                    {classes.length === 0 
                      ? '⚠️ Create classes first' 
                      : `Add subjects to your curriculum • ${subjects.length} total`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value="subjects"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="subjects">Select CBT Subject</option>
                  </select>
                  <button
                    onClick={() => handleExportSubjects()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <i className='bx bx-download'></i>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Upload CSV Card */}
              <div 
                onClick={() => setUploadModal('subjects')}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-gray-400">
                    <i className='bx bx-file'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Upload CSV File</h3>
                <p className="text-sm text-gray-600">Bulk upload subjects from CSV</p>
              </div>

              {/* Add Manual Card */}
              <div 
                onClick={() => classes.length > 0 && handleDownloadSampleCSV('subjects')}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                  classes.length === 0 
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50'
                    : 'border-green-500 hover:border-green-600 hover:bg-green-50 cursor-pointer'
                }`}
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-green-500">
                    <i className='bx bx-download'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Download Sample CSV</h3>
                <p className="text-sm text-gray-600">Download CSV format template</p>
              </div>

              {/* Manual Entry Card */}
              <div 
                onClick={() => classes.length > 0 && setShowSubjectModal(true)}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                  classes.length === 0 
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50'
                    : 'border-purple-500 hover:border-purple-600 hover:bg-purple-50 cursor-pointer'
                }`}
              >
                <div className="flex justify-center mb-4">
                  <div className="text-5xl text-purple-500">
                    <i className='bx bx-edit'></i>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Manual Entry</h3>
                <p className="text-sm text-gray-600">Add subjects one by one</p>
              </div>
            </div>

            {/* Subjects List Section */}
            {subjects.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Your Subjects</h3>
                    <p className="text-xs text-gray-600">{subjects.length} total subjects</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setSubjectPage(1);
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                    </select>
                  </div>
                </div>

                {/* Selection Bar */}
                {subjects.length > 0 && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.length > 0 && selectedSubjects.length === subjects.length}
                          onChange={handleSelectAllSubjects}
                          className="w-5 h-5 cursor-pointer"
                          title="Select all subjects"
                        />
                        <span className="text-sm font-semibold text-blue-800">
                          {selectedSubjects.length > 0 ? `${selectedSubjects.length} of ${subjects.length} selected` : 'Select All'}
                        </span>
                      </div>
                      {selectedSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                          <button
                            onClick={handleExportSubjects}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                          >
                            <i className='bx bx-download text-sm'></i>Export
                          </button>
                          <button
                            onClick={handleBulkDeleteSubjects}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                          >
                            <i className='bx bx-trash text-sm'></i>Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Subjects Grid */}
                <div className="grid gap-3">
                  {getPaginatedData(subjects, subjectPage).map((subject) => (
                    <div key={subject.id} className={`border rounded-md p-3 hover:shadow-sm transition-shadow ${selectedSubjects.includes(subject.id) ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(subject.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjects([...selectedSubjects, subject.id]);
                            } else {
                              setSelectedSubjects(selectedSubjects.filter(id => id !== subject.id));
                            }
                          }}
                          className="mt-1 w-4 h-4 cursor-pointer"
                        />
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
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditSubject(subject)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                            title="Edit"
                          >
                            <i className='bx bx-edit text-lg'></i>
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            title="Delete"
                          >
                            <i className='bx bx-trash text-lg'></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
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
              </div>
            )}
          </div>
        )}

        {/* Department Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingDept ? 'Edit Department' : 'Create Department'}
                </h3>
                <button
                  onClick={() => {
                    setShowDeptModal(false);
                    setEditingDept(null);
                  }}
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
                <h3 className="text-lg font-bold text-gray-800">
                  {editingClass ? 'Edit Class' : 'Create Class'}
                </h3>
                <button
                  onClick={() => {
                    setShowClassModal(false);
                    setEditingClass(null);
                  }}
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
                <h3 className="text-lg font-bold text-gray-800">
                  {editingSubject ? 'Edit Subject' : 'Create Subject'}
                </h3>
                <button
                  onClick={() => {
                    setShowSubjectModal(false);
                    setEditingSubject(null);
                  }}
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
                          {cls.name}
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
        {/* Bulk Upload Modal */}
        {uploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Bulk Upload {uploadModal === 'departments' ? 'Departments' : uploadModal === 'classes' ? 'Classes' : 'Subjects'}
                </h3>
                <button
                  onClick={() => {
                    setUploadModal(null);
                    setUploadFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <i className='bx bx-x'></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Upload a CSV file with the following columns:
                  </p>
                  {uploadModal === 'departments' && (
                    <ul className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200 space-y-1 mb-3">
                      <li>• <strong>name</strong> (required)</li>
                      <li>• code (required)</li>
                      <li>• description (optional)</li>
                      <li>• class_level (optional, default: SSS)</li>
                      <li>• is_active (optional, default: 1)</li>
                    </ul>
                  )}
                  {uploadModal === 'classes' && (
                    <ul className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200 space-y-1 mb-3">
                      <li>• <strong>name</strong> (required)</li>
                      <li>• department_id (required)</li>
                      <li>• description (optional)</li>
                      <li>• capacity (optional, default: 30)</li>
                      <li>• is_active (optional, default: 1)</li>
                    </ul>
                  )}
                  {uploadModal === 'subjects' && (
                    <ul className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200 space-y-1 mb-3">
                      <li>• <strong>name</strong> (required)</li>
                      <li>• code (required)</li>
                      <li>• class_id (required)</li>
                      <li>• subject_type (required: core/elective)</li>
                      <li>• department_id (optional)</li>
                      <li>• description (optional)</li>
                    </ul>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <i className='bx bx-cloud-upload text-4xl text-gray-400 mb-2'></i>
                    <p className="text-sm font-medium text-gray-700">
                      {uploadFile ? uploadFile.name : 'Click to upload CSV'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadModal(null);
                      setUploadFile(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadModal && handleBulkUpload(uploadModal)}
                    disabled={!uploadFile || uploading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-md hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <i className='bx bx-loader-alt bx-spin'></i>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className='bx bx-upload'></i>
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectManagementNew;
