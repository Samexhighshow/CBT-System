import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ShortcutHandlers {
  onSearch?: () => void;
  onNew?: () => void;
  onEscape?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  const navigate = useNavigate();

  // Disable keyboard shortcuts on small screens or touch devices
  const shouldDisable = (() => {
    if (typeof window === 'undefined') return true;
    const isSmall = window.matchMedia('(max-width: 767px)').matches;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isSmall || isTouch;
  })();

  useEffect(() => {
    if (shouldDisable) return; // Skip registering shortcuts for small / touch devices
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;

      // Ctrl+K or Cmd+K - Search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (handlers.onSearch) {
          handlers.onSearch();
        }
      }

      // Ctrl+N or Cmd+N - New item
      if ((event.ctrlKey || event.metaKey) && event.key === 'n' && !isTyping) {
        event.preventDefault();
        if (handlers.onNew) {
          handlers.onNew();
        }
      }

      // Ctrl+S or Cmd+S - Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (handlers.onSave) {
          handlers.onSave();
        }
      }

      // Ctrl+R or Cmd+R - Refresh (override default)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r' && !isTyping) {
        if (handlers.onRefresh) {
          event.preventDefault();
          handlers.onRefresh();
        }
      }

      // Escape - Close modals/cancel
      if (event.key === 'Escape') {
        if (handlers.onEscape) {
          handlers.onEscape();
        }
      }

      // Alt+H - Go to home/dashboard
      if (event.altKey && event.key === 'h') {
        event.preventDefault();
        navigate('/');
      }

      // Alt+Q - Go to question bank (admin)
      if (event.altKey && event.key === 'q') {
        event.preventDefault();
        navigate('/admin/question-bank');
      }

      // Alt+E - Go to exams (admin)
      if (event.altKey && event.key === 'e') {
        event.preventDefault();
        navigate('/admin/exams');
      }

      // Alt+S - Go to students (admin)
      if (event.altKey && event.key === 's') {
        event.preventDefault();
        navigate('/admin/students');
      }

      // Alt+R - Go to results (admin/student)
      if (event.altKey && event.key === 'r') {
        event.preventDefault();
        navigate('/admin/results');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, navigate, shouldDisable]);
};

