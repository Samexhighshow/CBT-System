// Cheating Detection System
import { useEffect, useRef, useState, useCallback } from 'react';

export interface CheatingEvent {
  type: 'tab_switch' | 'window_blur' | 'copy' | 'paste' | 'right_click' | 'dev_tools' | 'fullscreen_exit' | 'multiple_tabs';
  timestamp: number;
  details?: string;
}

export interface CheatingDetectionConfig {
  enableTabSwitchDetection?: boolean;
  enableCopyPasteDetection?: boolean;
  enableRightClickBlock?: boolean;
  enableDevToolsDetection?: boolean;
  enableFullscreenEnforcement?: boolean;
  enableMultipleTabDetection?: boolean;
  maxViolations?: number;
  onViolation?: (event: CheatingEvent) => void;
  onMaxViolationsReached?: () => void;
}

export const useCheatingDetection = (config: CheatingDetectionConfig = {}) => {
  const {
    enableTabSwitchDetection = true,
    enableCopyPasteDetection = true,
    enableRightClickBlock = true,
    enableDevToolsDetection = true,
    enableFullscreenEnforcement = true,
    enableMultipleTabDetection = true,
    maxViolations = 5,
    onViolation,
    onMaxViolationsReached,
  } = config;

  const [violations, setViolations] = useState<CheatingEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tabSwitchCount = useRef(0);
  const lastActivityTime = useRef(Date.now());
  const tabId = useRef(`tab-${Date.now()}-${Math.random()}`);

  const logViolation = useCallback((event: CheatingEvent) => {
    setViolations(prev => {
      const newViolations = [...prev, event];
      
      // Store in IndexedDB for later sync
      storeViolationInDB(event);
      
      if (onViolation) {
        onViolation(event);
      }

      if (newViolations.length >= maxViolations && onMaxViolationsReached) {
        onMaxViolationsReached();
      }

      return newViolations;
    });
  }, [maxViolations, onViolation, onMaxViolationsReached]);

  // Tab switch / Window blur detection
  useEffect(() => {
    if (!enableTabSwitchDetection) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current++;
        logViolation({
          type: 'tab_switch',
          timestamp: Date.now(),
          details: `Tab switch count: ${tabSwitchCount.current}`,
        });
      }
    };

    const handleBlur = () => {
      logViolation({
        type: 'window_blur',
        timestamp: Date.now(),
        details: 'Window lost focus',
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enableTabSwitchDetection, logViolation]);

  // Copy/Paste detection
  useEffect(() => {
    if (!enableCopyPasteDetection) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation({
        type: 'copy',
        timestamp: Date.now(),
        details: 'Attempted to copy content',
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      // Allow paste in input fields but log it
      logViolation({
        type: 'paste',
        timestamp: Date.now(),
        details: 'Pasted content',
      });
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enableCopyPasteDetection, logViolation]);

  // Right-click blocking
  useEffect(() => {
    if (!enableRightClickBlock) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation({
        type: 'right_click',
        timestamp: Date.now(),
        details: 'Right-click attempted',
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enableRightClickBlock, logViolation]);

  // Dev tools detection
  useEffect(() => {
    if (!enableDevToolsDetection) return;

    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        logViolation({
          type: 'dev_tools',
          timestamp: Date.now(),
          details: 'Developer tools detected',
        });
      }
    };

    const interval = setInterval(detectDevTools, 1000);

    return () => clearInterval(interval);
  }, [enableDevToolsDetection, logViolation]);

  // Fullscreen enforcement
  useEffect(() => {
    if (!enableFullscreenEnforcement) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      if (!isNowFullscreen) {
        logViolation({
          type: 'fullscreen_exit',
          timestamp: Date.now(),
          details: 'Exited fullscreen mode',
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enableFullscreenEnforcement, logViolation]);

  // Multiple tab detection using localStorage
  useEffect(() => {
    if (!enableMultipleTabDetection) return;

    const checkMultipleTabs = () => {
      const activeTabs = JSON.parse(localStorage.getItem('active_exam_tabs') || '[]');
      const currentTime = Date.now();
      
      // Clean old tabs (older than 5 seconds)
      const validTabs = activeTabs.filter((tab: any) => currentTime - tab.lastActivity < 5000);
      
      // Check if current tab is already registered
      const existingTabIndex = validTabs.findIndex((tab: any) => tab.id === tabId.current);
      
      if (existingTabIndex >= 0) {
        validTabs[existingTabIndex].lastActivity = currentTime;
      } else {
        validTabs.push({ id: tabId.current, lastActivity: currentTime });
      }

      // Detect multiple tabs
      if (validTabs.length > 1) {
        logViolation({
          type: 'multiple_tabs',
          timestamp: Date.now(),
          details: `${validTabs.length} tabs detected`,
        });
      }

      localStorage.setItem('active_exam_tabs', JSON.stringify(validTabs));
    };

    const interval = setInterval(checkMultipleTabs, 2000);
    checkMultipleTabs(); // Initial check

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      const activeTabs = JSON.parse(localStorage.getItem('active_exam_tabs') || '[]');
      const filteredTabs = activeTabs.filter((tab: any) => tab.id !== tabId.current);
      localStorage.setItem('active_exam_tabs', JSON.stringify(filteredTabs));
    };
  }, [enableMultipleTabDetection, logViolation]);

  // Request fullscreen
  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, []);

  return {
    violations,
    violationCount: violations.length,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
    tabSwitchCount: tabSwitchCount.current,
  };
};

// Store violation in IndexedDB for later sync
async function storeViolationInDB(event: CheatingEvent) {
  try {
    const db = await openDB();
    const tx = db.transaction('cheating_logs', 'readwrite');
    const store = tx.objectStore('cheating_logs');
    await store.add({
      ...event,
      synced: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to store violation:', error);
  }
}

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CBT_System', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cheating_logs')) {
        db.createObjectStore('cheating_logs', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('exam_data')) {
        db.createObjectStore('exam_data', { keyPath: 'exam_id' });
      }
      if (!db.objectStoreNames.contains('pending_submissions')) {
        db.createObjectStore('pending_submissions', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}
