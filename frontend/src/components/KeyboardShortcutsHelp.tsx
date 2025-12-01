import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // General Shortcuts
  { keys: 'Ctrl + K', description: 'Search', category: 'General' },
  { keys: 'Ctrl + N', description: 'Create New', category: 'General' },
  { keys: 'Ctrl + S', description: 'Save', category: 'General' },
  { keys: 'Ctrl + R', description: 'Refresh', category: 'General' },
  { keys: 'Esc', description: 'Cancel/Close', category: 'General' },
  { keys: 'Shift + /', description: 'Show Keyboard Shortcuts', category: 'General' },
  
  // Navigation Shortcuts
  { keys: 'Alt + H', description: 'Go to Home', category: 'Navigation' },
  { keys: 'Alt + Q', description: 'Go to Question Bank', category: 'Navigation' },
  { keys: 'Alt + E', description: 'Go to Exams', category: 'Navigation' },
  { keys: 'Alt + S', description: 'Go to Students', category: 'Navigation' },
  { keys: 'Alt + R', description: 'Go to Results', category: 'Navigation' },
];

const KeyboardShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSmallOrTouch, setIsSmallOrTouch] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      if (typeof window === 'undefined') return;
      const isSmall = window.matchMedia('(max-width: 767px)').matches;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsSmallOrTouch(isSmall || isTouch);
    };
    evaluate();
    window.addEventListener('resize', evaluate);
    return () => window.removeEventListener('resize', evaluate);
  }, []);

  useEffect(() => {
    if (isSmallOrTouch) return; // Do not enable keyboard listener on small/touch devices
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts help with "?" key (Shift + /)
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        setIsOpen(true);
      }
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSmallOrTouch]);

  // Hide entirely on small/touch devices
  if (isSmallOrTouch) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl hover:bg-blue-700 transition-all hover:scale-110 z-50"
        title="Keyboard Shortcuts (Press Shift + /)"
        aria-label="Show keyboard shortcuts"
      >
        <i className='bx bx-keyboard text-3xl'></i>
      </button>
    );
  }

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-600 mt-1">Speed up your workflow</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
            title="Close (Esc)"
            aria-label="Close shortcuts help"
          >
            <i className='bx bx-x text-3xl'></i>
          </button>
        </div>

        {categories.map(category => (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">{category}</h3>
            <div className="space-y-2">
              {shortcuts
                .filter(s => s.category === category)
                .map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 px-3 rounded hover:bg-gray-50"
                  >
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-3 py-1.5 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t">
          <Button onClick={() => setIsOpen(false)} fullWidth>
            <i className='bx bx-check'></i>
            <span className="ml-2">Got it</span>
          </Button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Press <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">Shift + /</kbd> anytime to show this help
        </div>
      </Card>
    </div>
  );
};

export default KeyboardShortcutsHelp;
