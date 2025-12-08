import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useTeacherSetup } from './hooks/useTeacherSetup';
import { useTheme } from './hooks/useTheme';
import TeacherSubjectAssignmentModal from './components/TeacherSubjectAssignmentModal';
import { ErrorBoundary, KeyboardShortcutsHelp, OfflineRouteHandler } from './components';

// Pages
import LandingPage from './pages/LandingPage';
import StudentRegistrationSteps from './pages/StudentRegistrationSteps';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import ExamPortal from './pages/ExamPortal';
import OfflineExamPortal from './pages/OfflineExamPortal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PasswordResetRequest from './pages/PasswordResetRequest';
import PasswordReset from './pages/PasswordReset';
import PasswordOtpRequest from './pages/PasswordOtpRequest';
import PasswordOtpReset from './pages/PasswordOtpReset';
import AdminSignup from './pages/admin/AdminSignup';
import AdminUserManagement from './pages/admin/AdminUserManagement';
import AdminSettings from './pages/admin/AdminSettings';
import Profile from './pages/Profile';
import SubjectSelection from './pages/SubjectSelection';
import QuestionBank from './pages/admin/QuestionBank';
import RequireAuth from './middleware/RequireAuth';
import RequireRole from './middleware/RequireRole';

const App: React.FC = () => {
  const { showModal, handleComplete, handleSkip } = useTeacherSetup();
  
  // Initialize theme
  useTheme();

  return (
    <>
      <TeacherSubjectAssignmentModal
        isOpen={showModal}
        onClose={handleSkip}
        onComplete={handleComplete}
      />
      
      <ErrorBoundary>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {/* Global Keyboard Shortcuts Help */}
          <KeyboardShortcutsHelp />
          
          {/* Offline Route Handler - Manages offline routing */}
          <OfflineRouteHandler>
            <Routes>
          {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<StudentRegistrationSteps />} />
        <Route path="/login" element={<StudentLogin />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<PasswordResetRequest />} />
        <Route path="/reset-password" element={<PasswordReset />} />
        <Route path="/forgot-password-otp" element={<PasswordOtpRequest />} />
        <Route path="/reset-password-otp" element={<PasswordOtpReset />} />
        <Route path="/admin/signup" element={<AdminSignup />} />
        
        {/* Profile Route (All authenticated users) */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        
        {/* Subject Selection (Students after registration) */}
        <Route
          path="/select-subjects"
          element={
            <RequireAuth>
              <SubjectSelection />
            </RequireAuth>
          }
        />
        
        {/* Student Routes */}
        <Route
          path="/student/*"
          element={
            <RequireAuth>
              <RequireRole roles={["Student"]}>
                <StudentDashboard />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/exam/:id"
          element={
            <RequireAuth>
              <ExamPortal />
            </RequireAuth>
          }
        />
        <Route
          path="/offline-exam/:examId"
          element={
            <RequireAuth>
              <OfflineExamPortal />
            </RequireAuth>
          }
        />
        
        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <RequireRole roles={["Admin","Main Admin"]}>
                <AdminDashboard />
              </RequireRole>
            </RequireAuth>
          }
        />
        
        <Route
          path="/admin/settings"
          element={
            <RequireAuth>
              <RequireRole roles={["Main Admin"]}>
                <AdminSettings />
              </RequireRole>
            </RequireAuth>
          }
        />
        
        <Route
          path="/admin/question-entry"
          element={
            <RequireAuth>
              <RequireRole roles={["Admin","Main Admin","Teacher"]}>
                <QuestionBank />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Roles management is accessible via existing /admin/users page */}
        
        {/* Default Route */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </OfflineRouteHandler>
    </Router>
      </ErrorBoundary>
    </>
  );
};

export default App;
