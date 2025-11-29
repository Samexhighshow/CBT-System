import React from 'react';

const FooterMinimal: React.FC = () => {
  return (
    <footer className="w-full border-t bg-white/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-gray-500 flex items-center justify-between">
        <span>&copy; {new Date().getFullYear()} CBT System</span>
        <span>
          Built by <span className="text-blue-600 font-semibold">Maximus</span> •
          <span className="bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text text-transparent font-semibold ml-1">MAVIS</span>
        </span>
      </div>
    </footer>
  );
};

export default FooterMinimal;
