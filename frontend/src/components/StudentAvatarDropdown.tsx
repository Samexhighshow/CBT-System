import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Modal from './Modal';

const StudentProfileSettings = React.lazy(() => import('../pages/student/StudentProfileSettings'));

type ProfileSection = 'profile' | 'password';

const StudentAvatarDropdown: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>('profile');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openProfileModal = (section: ProfileSection) => {
    setProfileSection(section);
    setShowProfileModal(true);
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('subjectsSelected');
    navigate('/student-login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none"
        type="button"
      >
        {user?.profile_picture ? (
          <img
            src={user.profile_picture}
            alt={user.name}
            className="h-10 w-10 rounded-full object-cover shadow"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-cyan-600 text-white flex items-center justify-center font-semibold shadow">
            <span className="text-sm">{getInitials(user?.name || 'S')}</span>
          </div>
        )}
        <svg
          className={`h-4 w-4 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">{user?.name || 'Student'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800 rounded">
              Student
            </span>
          </div>

          <button
            onClick={() => openProfileModal('profile')}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            type="button"
          >
            <i className="bx bx-user-circle" />
            <span>Profile & Security</span>
          </button>

          <button
            onClick={() => openProfileModal('password')}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            type="button"
          >
            <i className="bx bx-lock" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => {
              navigate('/student/results');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            type="button"
          >
            <i className="bx bx-bar-chart-alt" />
            <span>My Results</span>
          </button>

          <button
            onClick={() => {
              navigate('/select-subjects');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            type="button"
          >
            <i className="bx bx-book-open" />
            <span>Subject Selection</span>
          </button>

          <div className="border-t border-slate-100 my-1" />

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            type="button"
          >
            <i className="bx bx-log-out" />
            <span>Logout</span>
          </button>
        </div>
      )}

      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Profile Settings"
        size="2xl"
      >
        <React.Suspense fallback={<div className="p-4">Loading...</div>}>
          <StudentProfileSettings initialSection={profileSection} />
        </React.Suspense>
      </Modal>
    </div>
  );
};

export default StudentAvatarDropdown;
