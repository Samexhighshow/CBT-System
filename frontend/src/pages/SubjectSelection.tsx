import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components';
import { showError, showSuccess } from '../utils/alerts';
import { api } from '../services/api';

interface SubjectRow {
  id: number;
  name: string;
  code?: string;
  description?: string | null;
  is_compulsory?: boolean;
  subject_type?: string;
}

const SubjectSelection: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);

  const coreSubjects = useMemo(
    () => allSubjects.filter((s) => Boolean(s.is_compulsory) || String(s.subject_type || '').toLowerCase() === 'core'),
    [allSubjects]
  );

  const electiveSubjects = useMemo(
    () => allSubjects.filter((s) => !coreSubjects.some((core) => core.id === s.id)),
    [allSubjects, coreSubjects]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const prefRes = await api.get('/preferences/student/subjects');
        const classId = prefRes.data?.class_id;
        const existing = Array.isArray(prefRes.data?.student_subjects) ? prefRes.data.student_subjects : [];

        if (!classId) {
          showError('Student class is not set. Contact admin to assign your class.');
          setAllSubjects([]);
          setSelectedSubjectIds([]);
          return;
        }

        const classRes = await api.get(`/preferences/subjects/class/${classId}`);
        const classSubjects: SubjectRow[] = Array.isArray(classRes.data?.subjects) ? classRes.data.subjects : [];
        setAllSubjects(classSubjects);

        const existingIds = new Set<number>(existing.map((s: SubjectRow) => Number(s.id)));
        const mandatoryIds = classSubjects
          .filter((s) => Boolean(s.is_compulsory) || String(s.subject_type || '').toLowerCase() === 'core')
          .map((s) => s.id);

        const merged: number[] = Array.from(new Set<number>([...mandatoryIds, ...Array.from(existingIds)]));
        setSelectedSubjectIds(merged);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load available subjects');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const toggleElective = (subjectId: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const saveSubjects = async () => {
    if (selectedSubjectIds.length === 0) {
      showError('Please select at least one subject');
      return;
    }

    setSaving(true);
    try {
      await api.post('/preferences/student/subjects', { subject_ids: selectedSubjectIds });
      localStorage.setItem('subjectsSelected', 'true');
      showSuccess('Subject registration saved');
      navigate('/student', { replace: true });
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to save selected subjects');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-cyan-200 border-t-cyan-600 animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-600">Loading subject registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Subject Registration</h1>
          <p className="text-sm text-slate-600 mt-1">
            Register only subjects available for your class. Core subjects are marked as important.
          </p>
        </div>

        <Card className="border border-rose-200 bg-rose-50">
          <h2 className="text-lg font-semibold text-rose-900">Core Subjects (Important)</h2>
          <p className="text-xs text-rose-800 mt-1">These are compulsory and cannot be removed.</p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {coreSubjects.length === 0 ? (
              <p className="text-sm text-slate-600">No core subjects configured for this class.</p>
            ) : (
              coreSubjects.map((subject) => (
                <div key={subject.id} className="rounded-xl border border-rose-300 bg-white p-3 opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{subject.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{subject.code || 'Core'}</p>
                      {subject.description && <p className="text-xs text-slate-600 mt-1">{subject.description}</p>}
                    </div>
                    <input type="checkbox" checked readOnly className="mt-1 h-4 w-4 text-rose-600" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="border border-cyan-200 bg-cyan-50">
          <h2 className="text-lg font-semibold text-cyan-900">Elective Subjects (By Choice)</h2>
          <p className="text-xs text-cyan-800 mt-1">Select only the electives you want to offer.</p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {electiveSubjects.length === 0 ? (
              <p className="text-sm text-slate-600">No electives configured for this class.</p>
            ) : (
              electiveSubjects.map((subject) => {
                const selected = selectedSubjectIds.includes(subject.id);
                return (
                  <button
                    type="button"
                    key={subject.id}
                    onClick={() => toggleElective(subject.id)}
                    className={`text-left rounded-xl border p-3 transition ${
                      selected ? 'border-cyan-500 bg-white shadow-sm' : 'border-cyan-200 bg-white/70 hover:border-cyan-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{subject.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{subject.code || 'Elective'}</p>
                        {subject.description && <p className="text-xs text-slate-600 mt-1">{subject.description}</p>}
                      </div>
                      <input type="checkbox" checked={selected} readOnly className="mt-1 h-4 w-4 text-cyan-600" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-600">
              Selected: <span className="font-semibold text-slate-900">{selectedSubjectIds.length}</span> subject(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedSubjectIds(coreSubjects.map((s) => s.id))}
                disabled={saving}
              >
                Reset Electives
              </Button>
              <Button onClick={saveSubjects} loading={saving}>
                Save & Continue
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SubjectSelection;
