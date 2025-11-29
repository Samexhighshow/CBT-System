import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components';
import { showSuccess, showError } from '../utils/alerts';
import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

interface Subject {
  id: number;
  name: string;
  description: string | null;
  subject_group: 'compulsory' | 'trade' | 'elective';
}

interface SubjectGroups {
  compulsory: Subject[];
  trade: Subject[];
  elective: Subject[];
}

const SubjectSelection: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<SubjectGroups>({
    compulsory: [],
    trade: [],
    elective: []
  });
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      // Get student info from user or localStorage
      const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
      const classLevel = studentData.class_level || 'JSS1';
      const departmentId = studentData.department_id || null;

      const response = await axios.post(
        `${API_URL}/subjects/for-student`,
        { class_level: classLevel, department_id: departmentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSubjects(response.data);
      
      // Auto-select compulsory subjects
      const compulsoryIds = response.data.compulsory.map((s: Subject) => s.id);
      setSelectedSubjects(compulsoryIds);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId: number, isCompulsory: boolean) => {
    if (isCompulsory) return; // Can't deselect compulsory subjects
    
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSave = async () => {
    if (selectedSubjects.length < subjects.compulsory.length) {
      showError('You must select all compulsory subjects');
      return;
    }

    setSaving(true);
    try {
      const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
      const studentId = studentData.id || user?.id;

      await axios.post(
        `${API_URL}/subjects/student/save`,
        { student_id: studentId, subject_ids: selectedSubjects },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showSuccess('Subjects saved successfully!');
      
      // Mark subject selection as complete
      localStorage.setItem('subjectsSelected', 'true');
      
      // Navigate to student dashboard
      setTimeout(() => navigate('/student'), 1500);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save subjects');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Subjects</h1>
          <p className="text-gray-600">Choose your trade and elective subjects for this academic session</p>
        </div>

        <div className="space-y-6">
          {/* Compulsory Subjects */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
              Compulsory Subjects
            </h2>
            <p className="text-sm text-gray-600 mb-4">These subjects are mandatory for all students</p>
            <div className="grid md:grid-cols-2 gap-3">
              {subjects.compulsory.map(subject => (
                <div
                  key={subject.id}
                  className="p-4 border-2 border-blue-300 bg-blue-50 rounded-lg cursor-not-allowed opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{subject.name}</h3>
                      {subject.description && (
                        <p className="text-sm text-gray-600 mt-1">{subject.description}</p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      className="w-5 h-5 text-blue-600 rounded cursor-not-allowed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Trade Subjects */}
          {subjects.trade.length > 0 && (
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                Trade Subjects
              </h2>
              <p className="text-sm text-gray-600 mb-4">Select your trade subjects (click to select/deselect)</p>
              <div className="grid md:grid-cols-2 gap-3">
                {subjects.trade.map(subject => {
                  const isSelected = selectedSubjects.includes(subject.id);
                  return (
                    <div
                      key={subject.id}
                      onClick={() => toggleSubject(subject.id, false)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{subject.name}</h3>
                          {subject.description && (
                            <p className="text-sm text-gray-600 mt-1">{subject.description}</p>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-5 h-5 text-green-600 rounded pointer-events-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Elective Subjects */}
          {subjects.elective.length > 0 && (
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-purple-600 rounded-full mr-2"></span>
                Elective Subjects
              </h2>
              <p className="text-sm text-gray-600 mb-4">Select your elective subjects (click to select/deselect)</p>
              <div className="grid md:grid-cols-2 gap-3">
                {subjects.elective.map(subject => {
                  const isSelected = selectedSubjects.includes(subject.id);
                  return (
                    <div
                      key={subject.id}
                      onClick={() => toggleSubject(subject.id, false)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{subject.name}</h3>
                          {subject.description && (
                            <p className="text-sm text-gray-600 mt-1">{subject.description}</p>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-5 h-5 text-purple-600 rounded pointer-events-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Selected Subjects</h3>
                <p className="text-sm text-gray-600 mt-1">
                  You have selected {selectedSubjects.length} subject(s)
                </p>
              </div>
              <Button onClick={handleSave} loading={saving} disabled={selectedSubjects.length === 0}>
                Save & Continue
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubjectSelection;
