import React, { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AvatarDropdown } from '../components';
import FooterMinimal from '../components/FooterMinimal';
import useAuthStore from '../store/authStore';
import StudentAnnouncements from './StudentAnnouncements';
import AvailableExams from './student/AvailableExams';
import MyAllocation from './student/MyAllocation';
import MyResults from './student/MyResults';
import StudentOverview from './student/StudentOverview';
import StudentProfileSettings from './student/StudentProfileSettings';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${isActive
    ? 'bg-cyan-100 text-cyan-800'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      navigate('/student-login');
    }
  }, [navigate, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                <i className="bx bx-graduation text-xl" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Student Area</p>
                <p className="text-sm font-semibold text-slate-900 truncate">CBT Portal</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1">
              <NavLink to="/student" end className={navLinkClass}>Overview</NavLink>
              <NavLink to="/student/exams" className={navLinkClass}>Exams</NavLink>
              <NavLink to="/student/results" className={navLinkClass}>Results</NavLink>
              <NavLink to="/student/allocations" className={navLinkClass}>Allocations</NavLink>
              <NavLink to="/student/announcements" className={navLinkClass}>Announcements</NavLink>
              <NavLink to="/student/profile" className={navLinkClass}>Profile</NavLink>
            </div>
          </div>

          <AvatarDropdown showSettings={false} />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Routes>
          <Route index element={<StudentOverview />} />
          <Route path="exams" element={<AvailableExams />} />
          <Route path="results" element={<MyResults />} />
          <Route path="allocations" element={<MyAllocation />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="profile" element={<StudentProfileSettings />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </main>

      <FooterMinimal />
    </div>
  );
};

export default StudentDashboard;
