import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import Card from './Card';
import Button from './Button';
import Alert from './Alert';

interface Subject {
  id: number;
  subject_name: string;
  class_level: string;
}

interface TeacherSubjectAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TeacherSubjectAssignmentModal: React.FC<TeacherSubjectAssignmentModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only load subjects when modal is actually open
    if (isOpen) {
      loadSubjects();
    } else {
      // Reset state when modal closes
      setSubjects([]);
      setSelectedSubjects([]);
      setError('');
    }
  }, [isOpen]);

  const loadSubjects = async () => {
    setLoadingSubjects(true);
    setError('');
    try {
      const res = await api.get('/cbt/subjects');
      console.log('Subjects API response:', res.data);
      
      // The API returns { status: 'ok', subjects: [...] }
      const subjectsData = res.data?.subjects || res.data?.data || res.data;
      console.log('Subjects data:', subjectsData);
      
      // Ensure we always set an array
      if (Array.isArray(subjectsData)) {
        setSubjects(subjectsData);
      } else if (subjectsData && typeof subjectsData === 'object') {
        // If it's an object with data property
        setSubjects(Array.isArray(subjectsData.data) ? subjectsData.data : []);
      } else {
        setSubjects([]);
      }
    } catch (err: any) {
      console.error('Failed to load subjects:', err);
      const errorMsg = err?.response?.data?.message || 'Failed to load subjects. Please try again.';
      setError(errorMsg);
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleToggleSubject = (subjectId: number) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      } else {
        return [...prev, subjectId];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject to teach');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/cbt/teachers/self-assign', {
        subject_ids: selectedSubjects
      });
      
      showSuccess('Subjects assigned successfully!');
      onComplete();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to assign subjects';
      showError(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome, Teacher! 👋
            </h2>
            <p className="text-gray-600">
              Please select the subjects and classes you'll be teaching. You can update this later in your profile.
            </p>
          </div>

          {error && (
            <Alert type="error" message={error} onClose={() => setError('')} />
          )}

          <Card>
            <h3 className="text-lg font-semibold mb-4">Available Subjects</h3>
            
            {loadingSubjects ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading subjects...</p>
              </div>
            ) : !Array.isArray(subjects) || subjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No subjects available. Please contact an administrator.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subjects.map(subject => (
                  <label
                    key={subject.id}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                      selectedSubjects.includes(subject.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(subject.id)}
                      onChange={() => handleToggleSubject(subject.id)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {subject.subject_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {subject.class_level}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Skip for Now
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedSubjects.length === 0 || submitting}
              loading={submitting}
            >
              Confirm Subjects ({selectedSubjects.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSubjectAssignmentModal;
