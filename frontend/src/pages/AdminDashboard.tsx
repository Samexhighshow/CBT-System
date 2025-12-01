import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../components';
import AdminOverview from './admin/AdminOverview';
import QuestionBank from './admin/QuestionBank';
import ExamManagement from './admin/ExamManagement';
import StudentManagement from './admin/StudentManagement';
import SubjectManagement from './admin/SubjectManagement';
import ResultsAnalytics from './admin/ResultsAnalytics';
import AdminUserManagement from './admin/AdminUserManagement';
import ActivityLogs from './admin/ActivityLogs';

// Admin Dashboard with shared layout
const AdminDashboard: React.FC = () => {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="questions" element={<QuestionBank />} />
        <Route path="exams" element={<ExamManagement />} />
        <Route path="students" element={<StudentManagement />} />
        <Route path="subjects" element={<SubjectManagement />} />
        <Route path="results" element={<ResultsAnalytics />} />
        <Route path="users" element={<AdminUserManagement />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminDashboard;
