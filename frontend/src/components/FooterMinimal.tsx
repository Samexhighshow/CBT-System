import React from 'react';

const FooterMinimal: React.FC = () => {
  return (
    <footer className="w-full border-t bg-white/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-gray-500 flex items-center justify-between">
        <span>© CBT System</span>
        <span>Built by Maximus • MAVIS</span>
      </div>
    </footer>
  );
};

export default FooterMinimal;
