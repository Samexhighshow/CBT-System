import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Pages
import LandingPage from './pages/LandingPage';
import StudentRegistration from './pages/StudentRegistration';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import ExamPortal from './pages/ExamPortal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PasswordResetRequest from './pages/PasswordResetRequest';
import PasswordReset from './pages/PasswordReset';
import RequireAuth from './middleware/RequireAuth';
import RequireRole from './middleware/RequireRole';

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<StudentRegistration />} />
        <Route path="/login" element={<StudentLogin />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<PasswordResetRequest />} />
        <Route path="/reset-password" element={<PasswordReset />} />

        {/* Student Routes */}
        <Route path="/student/*" element={<StudentDashboard />} />
        <Route
          path="/student/*"
          element={
            <RequireAuth>
              <RequireRole roles={["student"]}>
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

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <RequireRole roles={["admin","subadmin","teacher"]}>
                <AdminDashboard />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Default Route */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
};

export default App;
