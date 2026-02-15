import React, { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Loading, StudentAvatarDropdown } from '../components';
import FooterMinimal from '../components/FooterMinimal';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import StudentAnnouncements from './StudentAnnouncements';
import AvailableExams from './student/AvailableExams';
import MyAllocation from './student/MyAllocation';
import MyResults from './student/MyResults';
import StudentOverview from './student/StudentOverview';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `h-10 px-4 rounded-full text-sm font-medium transition inline-flex items-center ${isActive
    ? 'bg-cyan-100 text-cyan-800 border border-cyan-200 shadow-sm'
    : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900'
  }`;

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  let storedUser: any = null;
  try {
    const raw = localStorage.getItem('user');
    storedUser = raw ? JSON.parse(raw) : null;
  } catch {
    storedUser = null;
  }
  const activeUser = user || storedUser;

  useEffect(() => {
    if (!activeUser) {
      navigate('/student-login');
      return;
    }

    const roles = (activeUser?.roles || []).map((r: any) => String(r?.name || r).toLowerCase());
    if (!roles.includes('student')) return;

    const enforceSubjectSelection = async () => {
      try {
        const res = await api.get('/preferences/student/subjects');
        const picked = Array.isArray((res as any)?.data?.student_subjects)
          ? (res as any).data.student_subjects.length
          : 0;
        if (picked === 0) {
          localStorage.removeItem('subjectsSelected');
          navigate('/select-subjects', { replace: true });
        } else {
          localStorage.setItem('subjectsSelected', 'true');
        }
      } catch {
        navigate('/select-subjects', { replace: true });
      }
    };

    enforceSubjectSelection();
  }, [activeUser, navigate]);

  if (!activeUser) {
    return <Loading fullScreen message="Loading student portal..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto w-full max-w-[1200px] px-5">
          <div className="flex h-[68px] items-center">
            <div className="flex min-w-0 items-center gap-2 md:min-w-[190px]">
              <div className="h-9 w-9 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                <i className="bx bx-graduation text-xl" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Student Area</p>
                <p className="text-sm font-semibold text-slate-900 truncate">CBT Portal</p>
              </div>
            </div>

            <div className="hidden lg:flex flex-1 items-center justify-center px-4">
              <div className="flex items-center justify-center gap-2 xl:gap-3">
                <NavLink to="/student" end className={navLinkClass}>Overview</NavLink>
                <NavLink to="/student/exams" className={navLinkClass}>Exams</NavLink>
                <NavLink to="/student/results" className={navLinkClass}>Results</NavLink>
                <NavLink to="/student/allocations" className={navLinkClass}>Allocations</NavLink>
                <NavLink to="/student/announcements" className={navLinkClass}>Announcements</NavLink>
              </div>
            </div>

            <div className="ml-auto flex items-center justify-end md:min-w-[190px]">
              <StudentAvatarDropdown />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-6">
        <Routes>
          <Route index element={<StudentOverview />} />
          <Route path="exams" element={<AvailableExams />} />
          <Route path="results" element={<MyResults />} />
          <Route path="allocations" element={<MyAllocation />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </main>

      <div className="sticky bottom-0 z-30">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default StudentDashboard;
