import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Pages
import StudentRegistration from './pages/StudentRegistration';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import ExamPortal from './pages/ExamPortal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/register" element={<StudentRegistration />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* Student Routes */}
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/exam/:examId" element={<ExamPortal />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Default Route */}
        <Route path="/" element={<StudentRegistration />} />
      </Routes>
    </Router>
  );
}

export default App;
