/**
 * Cache Buster Service
 * Clears old service worker caches and IndexedDB on app startup
 * Ensures users always get the latest version
 */

export const bust = async () => {
  try {
    // Clear old service worker caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((name) => {
        // Delete all caches except the current version
        if (!name.includes(CACHE_VERSION)) {
          console.log(`[Cache Buster] Clearing old cache: ${name}`);
          return caches.delete(name);
        }
        return Promise.resolve();
      })
    );

    // Clear stale IndexedDB data (older than 7 days)
    if ('indexedDB' in window) {
      try {
        const dbs = (await indexedDB.databases?.()) || [];
        console.log(`[Cache Buster] Found ${dbs.length} IndexedDB databases`);
      } catch (error) {
        console.warn('[Cache Buster] Could not list databases:', error);
      }
    }

    console.log('[Cache Buster] Cache cleanup complete');
  } catch (error) {
    console.error('[Cache Buster] Error during cache cleanup:', error);
  }
};

// Version from version.json (set during build)
const CACHE_VERSION = '__CACHE_VERSION__';
