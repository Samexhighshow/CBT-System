import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';

export const useTeacherSetup = (enabled = true) => {
  const { user, isAuthenticated, completeTeacherSetup } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [scopeStatus, setScopeStatus] = useState<{
    has_approved_scope: boolean;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
    latest_rejection_reason: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setShowModal(false);
      return;
    }

    // Always close modal if no user is logged in
    if (!user || !isAuthenticated) {
      setShowModal(false);
      return;
    }

    // Don't show modal if email is not verified
    if (!user.email_verified_at) {
      setShowModal(false);
      return;
    }

    // Check if user is a teacher (case-insensitive to handle Teacher, teacher, TEACHER)
    const isTeacher = user.roles?.some((role: any) =>
      String(role?.name || role || '').toLowerCase() === 'teacher'
    );
    
    if (!isTeacher) {
      setShowModal(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/preferences/teacher/scope-status', { skipGlobalLoading: true } as any);
        if (cancelled) return;
        const status = res?.data || {};
        setScopeStatus(status);
        setShowModal(!Boolean(status?.has_approved_scope));
      } catch {
        if (!cancelled) {
          setScopeStatus(null);
          setShowModal(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, isAuthenticated]);

  const handleComplete = () => {
    completeTeacherSetup();
    setShowModal(false);
  };

  const handleSkip = () => {
    // Don't mark as complete so it shows again next login
    setShowModal(false);
  };

  return {
    showModal,
    handleComplete,
    handleSkip,
    scopeStatus,
  };
};
