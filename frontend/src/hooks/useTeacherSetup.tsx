import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';

export const useTeacherSetup = () => {
  const { user, hasCompletedTeacherSetup, completeTeacherSetup } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Always close modal if no user is logged in
    if (!user) {
      setShowModal(false);
      return;
    }

    // Check if user is a teacher (case-insensitive to handle Teacher, teacher, TEACHER)
    const isTeacher = user.roles?.some((role: any) => 
      role.name?.toLowerCase() === 'teacher'
    );
    
    // Show modal if:
    // 1. User is a teacher
    // 2. Haven't completed setup yet
    if (isTeacher && !hasCompletedTeacherSetup) {
      // Small delay to ensure smooth transition after login
      setTimeout(() => setShowModal(true), 500);
    } else {
      // Not a teacher or already completed - don't show modal
      setShowModal(false);
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
