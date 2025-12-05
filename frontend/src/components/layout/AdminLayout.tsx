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
    { name: 'Halls', path: '/admin/halls', icon: 'bx-building' },
    { name: 'Results', path: '/admin/results', icon: 'bx-bar-chart-alt-2' },
    { name: 'Users', path: '/admin/users', icon: 'bx-shield' },
    { name: 'Activity Logs', path: '/admin/activity-logs', icon: 'bx-history' },
  ];

  // Allocation system routes for dropdown
  const allocationRoutes = [
    { name: 'View Allocations', path: '/admin/allocations', icon: 'bx-layout' },
    { name: 'Generate Allocation', path: '/admin/allocations/generate', icon: 'bx-plus-circle' },
    { name: 'Teacher Assignment', path: '/admin/teachers/assign', icon: 'bx-user-check' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full">
      {/* Top Navigation Bar - Enhanced */}
      <nav className="bg-white shadow-md border-b border-gray-200 w-full sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Left Section: Logo + Desktop Nav */}
            <div className="flex items-center gap-6">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                aria-label="Toggle menu"
              >
                <i className={`bx ${isSidebarOpen ? 'bx-x' : 'bx-menu'} text-2xl`}></i>
              </button>

              {/* Logo */}
              <div className="flex items-center gap-1">
                <i className="bx bx-book text-lg text-blue-600"></i>
                <h1 className="text-lg font-bold text-gray-900">CBT Admin</h1>
              </div>
              
              {/* Desktop Navigation Links - Horizontal Tab Style */}
              <div className="hidden md:flex gap-0.5 ml-4">
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition flex items-center gap-1 whitespace-nowrap ${
                      isActivePath(link.path)
                        ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title={link.name}
                  >
                    <i className={`bx ${link.icon} text-base`}></i>
                    <span className="hidden sm:inline">{link.name}</span>
                  </button>
                ))}
                
                {/* Allocation System Dropdown - Desktop Only */}
                <div className="relative group">
                  <button
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition flex items-center gap-1 whitespace-nowrap ${
                      allocationRoutes.some(r => isActivePath(r.path))
                        ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title="Allocation System"
                  >
                    <i className="bx bx-layer text-base"></i>
                    <span className="hidden sm:inline">Allocation System</span>
                  </button>
                  <div className="absolute left-0 hidden group-hover:block bg-white shadow-lg rounded-b-lg border border-gray-200 z-50 w-56">
                    {allocationRoutes.map((route) => (
                      <button
                        key={route.path}
                        onClick={() => navigate(route.path)}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition ${
                          isActivePath(route.path)
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <i className={`bx ${route.icon}`}></i>
                        {route.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section: Avatar Dropdown */}
            <div className="flex items-center gap-4">
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
      <main className="flex-1 w-full overflow-y-auto">
        <div className="w-full max-w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <Outlet />
        </div>
      </main>

      <div className="w-full border-t border-gray-200 bg-white">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default AdminLayout;
