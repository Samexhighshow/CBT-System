import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import { Card, Button, Modal } from '../components';

interface Subject {
  id: number;
  name: string;
  code: string;
  class_level?: string;
  is_compulsory?: boolean;
  subject_group?: string;
}

interface SchoolClass {
  id: number;
  name: string;
  code: string;
  department_id?: number;
  department?: { id: number; name: string };
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface TeacherSubjectSelectionProps {
  onClose: () => void;
  onSave: () => void;
}

export const TeacherSubjectSelection: React.FC<TeacherSubjectSelectionProps> = ({ onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cbtSubjects, setCbtSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Array<{ subject_id: number; class_category: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Get CBT subjects (from CbtSubjectController or similar)
      const [subjectsRes, teacherSubjectsRes] = await Promise.all([
        api.get('/cbt/subjects'),
        api.get('/preferences/teacher/subjects')
      ]);

      setCbtSubjects(subjectsRes.data || []);
      
      if (teacherSubjectsRes.data?.teacher_subjects) {
        setSelectedSubjects(
          teacherSubjectsRes.data.teacher_subjects.map((ts: any) => ({
            subject_id: ts.subject_id,
            class_category: ts.class_category
          }))
        );
      }
    } catch (err) {
      showError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubject = (subjectId: number, classCategory: string) => {
    const exists = selectedSubjects.find(
      s => s.subject_id === subjectId && s.class_category === classCategory
    );

    if (exists) {
      setSelectedSubjects(selectedSubjects.filter(
        s => !(s.subject_id === subjectId && s.class_category === classCategory)
      ));
    } else {
      setSelectedSubjects([...selectedSubjects, { subject_id: subjectId, class_category: classCategory }]);
    }
  };

  const handleSave = async () => {
    if (selectedSubjects.length === 0) {
      showError('Please select at least one subject');
      return;
    }

    try {
      setSaving(true);
      await api.post('/preferences/teacher/subjects', {
        subjects: selectedSubjects
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
          <p className="mt-2 text-gray-600">Loading subjects...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="p-6 max-w-3xl">
        <h2 className="text-2xl font-bold mb-4">Select Your Teaching Subjects</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Choose the subjects you teach and the class levels (JSS, SSS, or Both)
        </p>

        {cbtSubjects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="bx bx-book text-4xl mb-2"></i>
            <p>No subjects available</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3 mb-6">
            {cbtSubjects.map((subject) => (
              <Card key={subject.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{subject.subject_name}</h3>
                    <p className="text-xs text-gray-500">Class Level: {subject.class_level || 'All'}</p>
                  </div>
                  <div className="flex gap-2">
                    {['JSS', 'SSS', 'Both'].map((category) => (
                      <label key={category} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.some(
                            s => s.subject_id === subject.id && s.class_category === category
                          )}
                          onChange={() => handleToggleSubject(subject.id, category)}
                          className="rounded"
                        />
                        <span className="text-xs text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || selectedSubjects.length === 0}>
            {saving ? 'Saving...' : 'Save Selection'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
