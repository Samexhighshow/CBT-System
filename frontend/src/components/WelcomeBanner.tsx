import React from 'react';
import { User } from '../types';

interface WelcomeBannerProps {
  user: User | null;
  portalTitle?: string;
  subtitle?: string;
  gradientClass?: string;
  icon?: string;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  user,
  portalTitle,
  subtitle = 'Have a great day at work',
  gradientClass = 'bg-gradient-to-r from-indigo-600 to-blue-500',
  icon = 'bx-user-circle',
}) => {
  // Determine role-based information
  const getUserRole = (): string => {
    if (!user?.roles || user.roles.length === 0) return 'User';
    const primaryRole = user.roles[0].name;
    return primaryRole;
  };

  const getPortalName = (): string => {
    if (portalTitle) return portalTitle;
    const role = getUserRole();
    if (role === 'Main Admin') return 'Main Admin Portal';
    if (role === 'Admin') return 'Admin Portal';
    if (role === 'Teacher') return 'Teacher Portal';
    if (role === 'Student') return 'Student Portal';
    return `${role} Portal`;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserTitle = (): string => {
    const role = getUserRole();
    if (role === 'Main Admin') return 'Administrator';
    if (role === 'Admin') return 'Administrator';
    if (role === 'Teacher') return 'Educator';
    if (role === 'Student') return '';
    return '';
  };

  const displayName = user?.name || 'User';
  const title = getUserTitle();
  const fullDisplayName = title ? `${title} ${displayName}` : displayName;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${gradientClass} text-white shadow-lg mb-8`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white" />
        <div className="absolute -right-20 top-20 h-32 w-32 rounded-full bg-white" />
        <div className="absolute right-10 -bottom-10 h-36 w-36 rounded-full bg-white" />
      </div>

      <div className="relative px-6 py-4 sm:px-8 sm:py-5 md:px-10 md:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left Content */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1">
                <p className="text-xs sm:text-sm font-medium text-white/90">
                  {getPortalName()}
                </p>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
              {getGreeting()}, {fullDisplayName}
            </h1>
            <p className="text-xs sm:text-sm text-white/90">
              {subtitle}
            </p>
          </div>

          {/* Right Illustration */}
          <div className="hidden sm:flex items-center justify-center">
            <div className="relative">
              <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <i className={`bx ${icon} text-4xl md:text-5xl text-white`}></i>
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-400 border-2 border-white flex items-center justify-center">
                <i className="bx bx-check text-white text-xs"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Role Badge (Mobile) */}
        <div className="sm:hidden mt-2 flex items-center gap-2">
          <i className={`bx ${icon} text-xl text-white/80`}></i>
          <span className="text-xs text-white/90">Logged in as {getUserRole()}</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
