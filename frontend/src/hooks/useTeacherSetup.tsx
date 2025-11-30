import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';

export const useTeacherSetup = () => {
  const { user, hasCompletedTeacherSetup, completeTeacherSetup } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowModal(false);
      return;
    }

    // Check if user is a teacher
    const isTeacher = user.roles?.some((role: any) => role.name === 'Teacher');
    
    // Show modal if:
    // 1. User is a teacher
    // 2. Haven't completed setup yet
    // 3. Modal isn't already showing
    if (isTeacher && !hasCompletedTeacherSetup && !showModal) {
      // Small delay to ensure smooth transition after login
      setTimeout(() => setShowModal(true), 500);
    }
  }, [user, hasCompletedTeacherSetup]);

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
  };
};
