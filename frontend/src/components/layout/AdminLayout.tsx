import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AvatarDropdown from '../AvatarDropdown';
import useAuthStore from '../../store/authStore';
import FooterMinimal from '../FooterMinimal';
import { adminNavLinks, NavLinkConfig } from '../../config/adminNav';
import { useRoleBasedNav } from '../../hooks/useRoleBasedNav';
import { TeacherSubjectSelection, StudentSubjectSelection } from '../index';
import Loading from '../Loading';
import { api } from '../../services/api';
import { showSuccess } from '../../utils/alerts';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showTeacherSubjects, setShowTeacherSubjects] = useState(false);
  const [showStudentSubjects, setShowStudentSubjects] = useState(false);
  const [checkedFirstLogin, setCheckedFirstLogin] = useState(false);
  const dropdownCloseTimerRef = useRef<number | null>(null);
  const { loading: navLoading, filterNavLinks } = useRoleBasedNav();

  useEffect(() => {
    if (!user) {
      navigate('/admin-login');
      return;
    }
    // Check if user has Main Admin role
    const hasMainAdminRole = user.roles?.some((role: any) => role.name === 'Main Admin');
    setIsMainAdmin(hasMainAdminRole || false);
    
    // Check if first login (needs subject selection)
    checkFirstLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, user]);

  const checkFirstLogin = async () => {
    if (checkedFirstLogin || !user) return;
    
    try {
      const isTeacher = user.roles?.some((role: any) => role.name === 'Teacher');
      const isStudent = user.roles?.some((role: any) => role.name === 'Student');
      
      if (isTeacher) {
        // Check if teacher has subjects selected
        const res = await api.get('/preferences/teacher/subjects');
        if (!res.data?.teacher_subjects || res.data.teacher_subjects.length === 0) {
          setShowTeacherSubjects(true);
        }
      } else if (isStudent) {
        // Check if student has class/subjects selected
        const res = await api.get('/preferences/student/subjects');
        if (!res.data?.class_id || !res.data?.student_subjects || res.data.student_subjects.length === 0) {
          setShowStudentSubjects(true);
        }
      }
      
      setCheckedFirstLogin(true);
    } catch (err) {
      console.error('Failed to check first login:', err);
      setCheckedFirstLogin(true);
    }
  };

  // Check first login for subject/class selection
  useEffect(() => {
    if (user && !checkedFirstLogin) {
      checkFirstLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkedFirstLogin]);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
    setOpenDropdown(null);
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, [location.pathname]);

  useEffect(() => () => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, []);

  if (!user || navLoading) {
    return <Loading fullScreen message="Loading admin portal..." />;
  }

  // Filter nav links based on user's role-based permissions
  const navLinks: NavLinkConfig[] = filterNavLinks(adminNavLinks);

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleDropdownEnter = (path: string) => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setOpenDropdown(path);
  };

  const handleDropdownLeave = (path: string) => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
    }
    dropdownCloseTimerRef.current = window.setTimeout(() => {
      setOpenDropdown((current) => (current === path ? null : current));
      dropdownCloseTimerRef.current = null;
    }, 140);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col w-full">
      {/* Top Navigation Bar - Desktop */}
      <nav className="sticky top-0 z-40 w-full border-b bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto w-full max-w-[1200px] px-5">
          <div className="flex items-center h-[68px]">
            {/* Left Section: Logo */}
            <div className="flex min-w-0 items-center gap-2 md:min-w-[180px]">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                <i className={`bx ${isSidebarOpen ? 'bx-x' : 'bx-menu'} text-xl`}></i>
              </button>

              <h1 className="text-lg font-bold text-blue-600 dark:text-blue-400">CBT Admin</h1>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex flex-1 items-center justify-center px-4">
              <div className="flex items-center justify-center gap-3 lg:gap-4 flex-wrap">
                {navLinks.map((link) => (
                  link.subItems ? (
                    // Dropdown Menu
                    <div
                      key={link.path}
                      className="relative"
                      onMouseEnter={() => handleDropdownEnter(link.path)}
                      onMouseLeave={() => handleDropdownLeave(link.path)}
                    >
                      <button
                        onClick={() => setOpenDropdown(openDropdown === link.path ? null : link.path)}
                        onFocus={() => handleDropdownEnter(link.path)}
                        className={`h-10 px-4 text-sm font-medium rounded-full transition inline-flex items-center gap-1.5 border ${
                          isActivePath(link.path)
                            ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-sm'
                            : 'text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <i className={`bx ${link.icon} text-sm`}></i>
                        <span className="hidden lg:inline">{link.name}</span>
                        <i className={`bx bx-chevron-down text-xs transition-transform ${openDropdown === link.path ? 'rotate-180' : ''}`}></i>
                      </button>
                      {openDropdown === link.path && (
                        <div
                          className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
                          onMouseEnter={() => handleDropdownEnter(link.path)}
                          onMouseLeave={() => handleDropdownLeave(link.path)}
                        >
                          <div className="w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                            {link.subItems.map((subItem) => (
                              <button
                                key={subItem.path}
                                onClick={() => {
                                  navigate(subItem.path);
                                  setOpenDropdown(null);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                  isActivePath(subItem.path)
                                    ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <i className={`bx ${subItem.icon} text-sm`}></i>
                                <span>{subItem.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular Menu Item
                    <button
                      key={link.path}
                      onClick={() => navigate(link.path)}
                      className={`h-10 px-4 text-sm font-medium rounded-full transition inline-flex items-center gap-1.5 border ${
                        isActivePath(link.path)
                          ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <i className={`bx ${link.icon} text-sm`}></i>
                      <span className="hidden lg:inline">{link.name}</span>
                    </button>
                  )
                ))}
              </div>
            </div>

            {/* Right Section: Avatar */}
            <div className="ml-auto flex items-center justify-end pl-2 md:min-w-[180px] md:pl-4">
              <AvatarDropdown showSettings={isMainAdmin} />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={() => setIsSidebarOpen(false)}
        ></div>

        {/* Sidebar */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-56 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 flex flex-col ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 flex-shrink-0">
            <h2 className="text-base font-bold text-blue-600 dark:text-blue-400">Navigation</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close menu"
              title="Close menu"
            >
              <i className="bx bx-x text-xl"></i>
            </button>
          </div>

          {/* Sidebar Navigation Links - Scrollable */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {navLinks.map((link) => (
              <React.Fragment key={link.path}>
                {link.subItems ? (
                  // Show subitems directly in mobile (no dropdown)
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      {link.name}
                    </div>
                    {link.subItems.map((subItem) => (
                      <button
                        key={subItem.path}
                        onClick={() => navigate(subItem.path)}
                        className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                          isActivePath(subItem.path)
                            ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <i className={`bx ${subItem.icon} text-lg`}></i>
                        <span>{subItem.name}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <button
                    onClick={() => navigate(link.path)}
                    className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                      isActivePath(link.path)
                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <i className={`bx ${link.icon} text-lg`}></i>
                    <span>{link.name}</span>
                  </button>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-x-hidden">
        <Outlet />
      </main>

      <div className="sticky bottom-0 z-30">
        <FooterMinimal />
      </div>

      {/* First Login Modals */}
      {showTeacherSubjects && (
        <TeacherSubjectSelection
          onClose={() => setShowTeacherSubjects(false)}
          onSave={() => {
            setShowTeacherSubjects(false);
            showSuccess('Subjects saved successfully');
          }}
        />
      )}
      {showStudentSubjects && (
        <StudentSubjectSelection
          onClose={() => setShowStudentSubjects(false)}
          onSave={() => {
            setShowStudentSubjects(false);
            showSuccess('Class and subjects saved successfully');
          }}
        />
      )}
    </div>
  );
};

export default AdminLayout;
