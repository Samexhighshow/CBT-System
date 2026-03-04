import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../components';
import AdminOverview from './admin/AdminOverview';
import QuestionBank from './admin/QuestionBank';
import ExamManagement from './admin/ExamManagement';
import StudentManagement from './admin/StudentManagement';
import SubjectManagement from './admin/SubjectManagementNew';
import ResultsAnalytics from './admin/ResultsAnalytics';
import AdminUserManagement from './admin/AdminUserManagement';
import ActivityLogs from './admin/ActivityLogs';
import AllocationGenerator from './admin/AllocationGenerator';
import AllocationHistory from './admin/AllocationHistory';
import AllocationViewer from './admin/AllocationViewer';
import HallManagement from './admin/HallManagement';
import TeacherAssignment from './admin/TeacherAssignment';
import ExamAccess from './admin/ExamAccess';
import AdminAnnouncements from './admin/Announcements';
import MarkingWorkbench from './admin/MarkingWorkbench';
import SyncDashboard from './admin/SyncDashboard';
import MyTeachingAssignment from './admin/MyTeachingAssignment';
import TeacherScopeRequests from './admin/TeacherScopeRequests';
import RequireRole from '../middleware/RequireRole';
import RequirePagePermission from '../middleware/RequirePagePermission';

const AdminForbidden: React.FC = () => (
  <div className="app-shell section-shell">
    <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <h2 className="text-xl font-semibold text-amber-800">Access Restricted</h2>
      <p className="mt-2 text-sm text-amber-700">
        Your current role does not have permission to view this module. Contact Main Admin to update access.
      </p>
    </div>
  </div>
);

// Admin Dashboard with shared layout
const AdminDashboard: React.FC = () => {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<RequirePagePermission permissionName="Overview"><AdminOverview /></RequirePagePermission>} />
        <Route path="questions" element={<RequirePagePermission permissionName="Questions"><QuestionBank /></RequirePagePermission>} />
        <Route path="exams" element={<RequirePagePermission permissionName="Exams"><ExamManagement /></RequirePagePermission>} />
        <Route path="exam-access" element={<RequirePagePermission permissionName="Exam Access"><ExamAccess /></RequirePagePermission>} />
        <Route path="announcements" element={<RequirePagePermission permissionName="Announcements"><AdminAnnouncements /></RequirePagePermission>} />
        <Route path="students" element={<RequirePagePermission permissionName="Students"><StudentManagement /></RequirePagePermission>} />
        <Route path="subjects" element={<RequirePagePermission permissionName="Academic Management"><SubjectManagement /></RequirePagePermission>} />
        <Route path="halls" element={<RequirePagePermission permissionName="Halls"><HallManagement /></RequirePagePermission>} />
        <Route path="allocations" element={<RequirePagePermission permissionName="View Allocations"><AllocationHistory /></RequirePagePermission>} />
        <Route path="allocations/generate" element={<RequirePagePermission permissionName="Generate Allocation"><AllocationGenerator /></RequirePagePermission>} />
        <Route path="allocations/:id" element={<RequirePagePermission permissionName="View Allocations"><AllocationViewer /></RequirePagePermission>} />
        <Route path="teachers/assign" element={<RequirePagePermission permissionName="Teacher Assignment"><TeacherAssignment /></RequirePagePermission>} />
        <Route path="my-teaching-assignment" element={<RequireRole roles={["Teacher"]}><MyTeachingAssignment /></RequireRole>} />
        <Route path="teacher-scope-requests" element={<RequireRole roles={["Main Admin"]}><TeacherScopeRequests /></RequireRole>} />
        <Route path="results" element={<RequirePagePermission permissionName="Results & Marking"><ResultsAnalytics /></RequirePagePermission>} />
        <Route path="marking" element={<RequirePagePermission permissionName="Marking Workbench"><MarkingWorkbench /></RequirePagePermission>} />
        <Route path="sync" element={<RequirePagePermission permissionName="Offline Sync"><SyncDashboard /></RequirePagePermission>} />
        <Route path="users" element={<RequireRole roles={["Main Admin"]}><AdminUserManagement /></RequireRole>} />
        <Route path="activity-logs" element={<RequireRole roles={["Main Admin"]}><ActivityLogs /></RequireRole>} />
        <Route path="forbidden" element={<AdminForbidden />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminDashboard;
