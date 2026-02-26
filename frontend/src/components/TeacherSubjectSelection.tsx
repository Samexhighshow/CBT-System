import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import { Card, Button, Modal } from '../components';

interface Subject {
  id: number;
  name: string;
}

interface SchoolClass {
  id: number;
  name: string;
}

interface TeacherSubjectSelectionProps {
  onClose: () => void;
  onSave: () => void;
}

export const TeacherSubjectSelection: React.FC<TeacherSubjectSelectionProps> = ({ onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [scopeRows, setScopeRows] = useState<Array<{ subject_id: number; class_id: number }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [optionsRes, teacherScopesRes] = await Promise.all([
          api.get('/preferences/options'),
          api.get('/preferences/teacher/subjects'),
        ]);

        const options = optionsRes?.data || {};
        const subjectRows = Array.isArray(options?.subjects) ? options.subjects : [];
        const classRows = Array.isArray(options?.classes) ? options.classes : [];

        setSubjects(
          subjectRows
            .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
            .filter((row: Subject) => row.id > 0 && row.name)
        );
        setClasses(
          classRows
            .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
            .filter((row: SchoolClass) => row.id > 0 && row.name)
        );

        const existing = Array.isArray(teacherScopesRes.data?.teacher_subjects)
          ? teacherScopesRes.data.teacher_subjects
          : [];
        setScopeRows(
          existing
            .map((row: any) => ({ subject_id: Number(row.subject_id), class_id: Number(row.class_id) }))
            .filter((row: any) => row.subject_id > 0 && row.class_id > 0)
        );
      } catch {
        showError('Failed to load subjects and classes');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const rowKey = (row: { subject_id: number; class_id: number }) => `${row.subject_id}:${row.class_id}`;

  const displayRows = useMemo(
    () =>
      scopeRows.map((row) => ({
        ...row,
        subject_name: subjects.find((s) => s.id === row.subject_id)?.name || `Subject #${row.subject_id}`,
        class_name: classes.find((c) => c.id === row.class_id)?.name || `Class #${row.class_id}`,
      })),
    [scopeRows, subjects, classes]
  );

  const handleAddPair = () => {
    if (!selectedSubjectId || !selectedClassId) {
      showError('Select both subject and class');
      return;
    }

    const pair = { subject_id: Number(selectedSubjectId), class_id: Number(selectedClassId) };
    if (scopeRows.some((row) => rowKey(row) === rowKey(pair))) {
      showError('This subject and class pair already exists');
      return;
    }

    setScopeRows((prev) => [...prev, pair]);
  };

  const handleSave = async () => {
    if (scopeRows.length === 0) {
      showError('Please add at least one subject and class pair');
      return;
    }

    try {
      setSaving(true);
      await api.post('/preferences/teacher/subjects', {
        subjects: scopeRows,
      });
      showSuccess('Scope request submitted for approval');
      onSave();
      onClose();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save scope request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen onClose={onClose}>
        <div className="p-8 text-center">
          <i className="bx bx-loader-alt animate-spin text-4xl text-blue-600"></i>
          <p className="mt-2 text-gray-600">Loading options...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="p-6 max-w-3xl">
        <h2 className="text-2xl font-bold mb-4">Select Your Teaching Scope</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Pick Subject + Class pairs. Requests are submitted for admin approval.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddPair}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Add Pair
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 mb-6 border border-gray-200 rounded">
          {displayRows.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No scope pairs selected yet.</div>
          ) : (
            displayRows.map((row) => (
              <Card key={`${row.subject_id}-${row.class_id}`} className="p-3 mx-2 my-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">{row.subject_name} · {row.class_name}</div>
                  <button
                    type="button"
                    onClick={() => setScopeRows((prev) => prev.filter((x) => rowKey(x) !== rowKey(row)))}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || scopeRows.length === 0}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
