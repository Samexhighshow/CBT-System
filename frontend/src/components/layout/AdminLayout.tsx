import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AvatarDropdown from '../AvatarDropdown';
import useAuthStore from '../../store/authStore';
import FooterMinimal from '../FooterMinimal';

interface NavLink {
  name: string;
  path: string;
  icon: string;
}

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col w-full">
      {/* Top Navigation Bar - Desktop */}
      <nav className="bg-white shadow-sm border-b w-full sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left Section: Logo + Desktop Nav */}
            <div className="flex items-center space-x-4">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                <i className={`bx ${isSidebarOpen ? 'bx-x' : 'bx-menu'} text-2xl`}></i>
              </button>

              <h1 className="text-xl font-bold text-blue-600">CBT Admin</h1>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:flex space-x-1">
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition flex items-center space-x-2 ${
                      isActivePath(link.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <i className={`bx ${link.icon}`}></i>
                    <span>{link.name}</span>
                  </button>
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
          className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl transform transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-bold text-blue-600">Navigation</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="Close menu"
              title="Close menu"
            >
              <i className="bx bx-x text-2xl"></i>
            </button>
          </div>

          {/* Sidebar Navigation Links */}
          <nav className="p-4 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition ${
                  isActivePath(link.path)
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <i className={`bx ${link.icon} text-xl`}></i>
                <span>{link.name}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <div className="mt-auto">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default AdminLayout;
