import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AvatarDropdown from '../AvatarDropdown';
import useAuthStore from '../../store/authStore';
import FooterMinimal from '../FooterMinimal';

interface NavLink {
  name: string;
  path: string;
  icon: string;
  subItems?: NavLink[];
}

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [allocationDropdownOpen, setAllocationDropdownOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/admin-login');
      return;
    }
    // Check if user has Main Admin role
    const hasMainAdminRole = user.roles?.some((role: any) => role.name === 'Main Admin');
    setIsMainAdmin(hasMainAdminRole || false);
  }, [navigate, user]);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const navLinks: NavLink[] = [
    { name: 'Overview', path: '/admin', icon: 'bx-home-alt' },
    { name: 'Questions', path: '/admin/questions', icon: 'bx-edit-alt' },
    { name: 'Exams', path: '/admin/exams', icon: 'bx-book-content' },
    { name: 'Students', path: '/admin/students', icon: 'bx-group' },
    { name: 'Subjects', path: '/admin/subjects', icon: 'bx-folder' },
    { name: 'Halls', path: '/admin/halls', icon: 'bx-building' },
    { 
      name: 'Allocation System', 
      path: '/admin/allocations', 
      icon: 'bx-layout',
      subItems: [
        { name: 'View Allocations', path: '/admin/allocations', icon: 'bx-list-ul' },
        { name: 'Generate Allocation', path: '/admin/allocations/generate', icon: 'bx-plus-circle' },
        { name: 'Teacher Assignment', path: '/admin/teachers/assign', icon: 'bx-user-check' },
      ]
    },
    { name: 'Results', path: '/admin/results', icon: 'bx-bar-chart-alt-2' },
    { name: 'Users', path: '/admin/users', icon: 'bx-shield' },
    { name: 'Activity Logs', path: '/admin/activity-logs', icon: 'bx-history' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col w-full">
      {/* Top Navigation Bar - Desktop */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 w-full sticky top-0 z-40">
        <div className="app-shell">
          <div className="flex justify-between items-center h-14">
            {/* Left Section: Logo + Desktop Nav */}
            <div className="flex items-center space-x-2">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                <i className={`bx ${isSidebarOpen ? 'bx-x' : 'bx-menu'} text-xl`}></i>
              </button>

              <h1 className="text-lg font-bold text-blue-600 dark:text-blue-400">CBT Admin</h1>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:flex space-x-0.5">
                {navLinks.map((link) => (
                  link.subItems ? (
                    // Dropdown Menu for Allocation System
                    <div key={link.path} className="relative">
                      <button
                        onClick={() => setAllocationDropdownOpen(!allocationDropdownOpen)}
                        className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition flex items-center space-x-1 ${
                          isActivePath(link.path)
                            ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <i className={`bx ${link.icon} text-sm`}></i>
                        <span className="hidden lg:inline">{link.name}</span>
                        <i className={`bx bx-chevron-down text-xs transition-transform ${allocationDropdownOpen ? 'rotate-180' : ''}`}></i>
                      </button>
                      {allocationDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                          {link.subItems.map((subItem) => (
                            <button
                              key={subItem.path}
                              onClick={() => {
                                navigate(subItem.path);
                                setAllocationDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center space-x-2 ${
                                isActivePath(subItem.path)
                                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <i className={`bx ${subItem.icon} text-sm`}></i>
                              <span>{subItem.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular Menu Item
                    <button
                      key={link.path}
                      onClick={() => navigate(link.path)}
                      className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition flex items-center space-x-1 ${
                        isActivePath(link.path)
                          ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
            <div className="flex items-center">
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
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <div className="mt-auto">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default AdminLayout;
