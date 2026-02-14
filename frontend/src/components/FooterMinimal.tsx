import React from 'react';

const FooterMinimal: React.FC = () => {
  return (
    <footer className="h-[48px] w-full border-t bg-white">
      <div className="app-shell flex h-full items-center justify-between text-xs text-gray-500">
        <span>&copy; {new Date().getFullYear()} CBT System</span>
        <span>
          Built by <span className="text-blue-600 font-semibold">Maximus</span> -
          <span className="ml-1 bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text font-semibold text-transparent">MAVIS</span>
        </span>
      </div>
    </footer>
  );
};

export default FooterMinimal;
