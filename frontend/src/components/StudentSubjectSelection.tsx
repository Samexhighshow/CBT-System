import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import { Card, Button, Modal } from '../components';

interface Subject {
  id: number;
  name: string;
  code: string;
  is_compulsory?: boolean;
  subject_group?: string;
  class_level?: string;
}

interface SchoolClass {
  id: number;
  name: string;
  code: string;
  department_id?: number;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface StudentSubjectSelectionProps {
  onClose: () => void;
  onSave: () => void;
}

export const StudentSubjectSelection: React.FC<StudentSubjectSelectionProps> = ({ onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'class' | 'subjects'>('class');
  
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  
  const [currentClass, setCurrentClass] = useState<any>(null);
  const [currentDepartment, setCurrentDepartment] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [optionsRes, studentSubjectsRes] = await Promise.all([
        api.get('/preferences/options'),
        api.get('/preferences/student/subjects')
      ]);

      setClasses(optionsRes.data?.classes || []);
      setDepartments(optionsRes.data?.departments || []);

      // Check if student already has class/department selected
      if (studentSubjectsRes.data) {
        const { class_id, department_id, student_subjects } = studentSubjectsRes.data;
        
        if (class_id) {
          setSelectedClassId(class_id);
          setCurrentClass(studentSubjectsRes.data.class);
          setCurrentDepartment(studentSubjectsRes.data.department);
          setSelectedDepartmentId(department_id);
          
          if (student_subjects && student_subjects.length > 0) {
            setSelectedSubjectIds(student_subjects.map((s: any) => s.id));
            setStep('subjects');
          }
          
          // Load subjects for this class
          loadSubjectsForClass(class_id);
        }
      }
    } catch (err) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectsForClass = async (classId: number) => {
    try {
      const res = await api.get(`/preferences/subjects/class/${classId}`);
      setSubjects(res.data?.subjects || []);
    } catch (err) {
      showError('Failed to load subjects for class');
    }
  };

  const handleClassSelect = async () => {
    if (!selectedClassId) {
      showError('Please select a class');
      return;
    }

    try {
      setSaving(true);
      
      // Save class and department selection
      await api.put('/preferences/student/class-department', {
        class_id: selectedClassId,
        department_id: selectedDepartmentId
      });

      // Load subjects for selected class
      await loadSubjectsForClass(selectedClassId);
      setStep('subjects');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save class selection');
    } finally {
      setSaving(false);
    }
  };

  const handleSubjectToggle = (subjectId: number) => {
    if (selectedSubjectIds.includes(subjectId)) {
      setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== subjectId));
    } else {
      setSelectedSubjectIds([...selectedSubjectIds, subjectId]);
    }
  };

  const handleSubjectsSave = async () => {
    const compulsorySubjects = subjects.filter(s => s.is_compulsory);
    const compulsoryIds = compulsorySubjects.map(s => s.id);
    const missingCompulsory = compulsoryIds.filter(id => !selectedSubjectIds.includes(id));

    if (missingCompulsory.length > 0) {
      showError('Please select all compulsory subjects');
      return;
    }

    if (selectedSubjectIds.length === 0) {
      showError('Please select at least one subject');
      return;
    }

    try {
      setSaving(true);
      await api.post('/preferences/student/subjects', {
        subject_ids: selectedSubjectIds
      });
      showSuccess('Subject selections saved successfully!');
      onSave();
      onClose();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save selections');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen onClose={onClose}>
        <div className="p-8 text-center">
          <i className="bx bx-loader-alt animate-spin text-4xl text-blue-600"></i>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="p-6 max-w-2xl">
        {step === 'class' ? (
          <>
            <h2 className="text-2xl font-bold mb-4">Select Your Class</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Choose your class level and department (if applicable)
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId || ''}
                  onChange={(e) => {
                    const classId = parseInt(e.target.value);
                    setSelectedClassId(classId);
                    const selectedClass = classes.find(c => c.id === classId);
                    if (selectedClass?.department_id) {
                      setSelectedDepartmentId(selectedClass.department_id);
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.code ? `(${cls.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClassId && departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department (Optional)
                  </label>
                  <select
                    value={selectedDepartmentId || ''}
                    onChange={(e) => setSelectedDepartmentId(parseInt(e.target.value) || null)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleClassSelect} disabled={saving || !selectedClassId}>
                {saving ? 'Saving...' : 'Next: Select Subjects'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Select Your Subjects</h2>
              <button
                onClick={() => setStep('class')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to Class Selection
              </button>
            </div>
            
            {currentClass && (
              <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
                <p><strong>Class:</strong> {currentClass.name}</p>
                {currentDepartment && <p><strong>Department:</strong> {currentDepartment.name}</p>}
              </div>
            )}

            <p className="text-gray-600 mb-4 text-sm">
              Select all subjects you're taking this session. Compulsory subjects are pre-selected.
            </p>

            {subjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="bx bx-book text-4xl mb-2"></i>
                <p>No subjects available for this class</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
                {subjects.map((subject) => (
                  <Card key={subject.id} className="p-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                        disabled={subject.is_compulsory}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{subject.name}</span>
                          {subject.is_compulsory && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Compulsory
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{subject.code}</p>
                      </div>
                    </label>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubjectsSave} disabled={saving || selectedSubjectIds.length === 0}>
                {saving ? 'Saving...' : 'Save Subjects'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
