import { offlineDB, SyncQueue } from './offlineDB';
import { examApi, studentApi } from './laravelApi';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingItems: number;
  failedItems: number;
}

class OfflineSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private listeners: Array<(status: SyncStatus) => void> = [];

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  // Subscribe to sync status changes
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  private notifyListeners(status: SyncStatus): void {
    this.listeners.forEach(callback => callback(status));
  }

  // Get current sync status
  async getStatus(): Promise<SyncStatus> {
    const pendingQueue = await offlineDB.syncQueue.getPending();
    const failedQueue = await offlineDB.syncQueue.getAll();
    
    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      lastSyncTime: this.getLastSyncTime(),
      pendingItems: pendingQueue.length,
      failedItems: failedQueue.filter(item => item.status === 'failed').length,
    };
  }

  // Handle online event
  private async handleOnline(): Promise<void> {
    console.log('🌐 Network connection restored');
    await this.sync();
    this.startAutoSync();
  }

  // Handle offline event
  private handleOffline(): void {
    console.log('📡 Network connection lost');
    this.stopAutoSync();
  }

  // Start automatic sync
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync();
      }
    }, intervalMs);
  }

  // Stop automatic sync
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync function
  async sync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('⚠️ Cannot sync: offline');
      return;
    }

    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync...');

    try {
      const pendingItems = await offlineDB.syncQueue.getPending();
      
      if (pendingItems.length === 0) {
        console.log('✅ Nothing to sync');
        return;
      }

      console.log(`📤 Syncing ${pendingItems.length} items...`);

      for (const item of pendingItems) {
        await this.syncItem(item);
      }

      // Update last sync time
      this.setLastSyncTime(new Date());
      
      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing = false;
      const status = await this.getStatus();
      this.notifyListeners(status);
    }
  }

  // Sync individual item
  private async syncItem(item: SyncQueue): Promise<void> {
    if (!item.id) return;

    try {
      await offlineDB.syncQueue.update(item.id, { status: 'processing' });

      switch (item.type) {
        case 'exam':
          await this.syncExam(item);
          break;
        case 'answer':
          await this.syncAnswer(item);
          break;
        case 'student':
          await this.syncStudent(item);
          break;
        case 'result':
          await this.syncResult(item);
          break;
        default:
          console.warn(`Unknown sync type: ${item.type}`);
      }

      await offlineDB.syncQueue.update(item.id, { 
        status: 'completed',
      });

      console.log(`✅ Synced ${item.type} (${item.action})`);
    } catch (error: any) {
      console.error(`❌ Failed to sync ${item.type}:`, error);
      
      await offlineDB.syncQueue.update(item.id, { 
        status: 'failed',
        retryCount: item.retryCount + 1,
        error: error.message || 'Unknown error',
      });
    }
  }

  // Sync exam
  private async syncExam(item: SyncQueue): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'create':
        await examApi.create(data);
        break;
      case 'update':
        await examApi.update(data.id, data);
        break;
      case 'delete':
        await examApi.delete(data.id);
        break;
    }
  }

  // Sync answer
  private async syncAnswer(item: SyncQueue): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'create':
        await examApi.submit(data.exam_id, data.answers);
        break;
      case 'update':
        // Answer updates not typically supported
        console.warn('Answer update not implemented');
        break;
      case 'delete':
        // Answer deletion not typically supported
        console.warn('Answer deletion not implemented');
        break;
    }
  }

  // Sync student
  private async syncStudent(item: SyncQueue): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'create':
        await studentApi.create(data);
        break;
      case 'update':
        await studentApi.update(data.id, data);
        break;
      case 'delete':
        await studentApi.delete(data.id);
        break;
    }
  }

  // Sync result
  private async syncResult(item: SyncQueue): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'create':
        await examApi.submit(data.exam_id, data.answers);
        break;
      default:
        console.warn('Result action not implemented:', action);
    }
  }

  // Add item to sync queue
  async addToQueue(
    type: SyncQueue['type'],
    action: SyncQueue['action'],
    data: any
  ): Promise<void> {
    await offlineDB.syncQueue.add({
      type,
      action,
      data,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
    });

    // Trigger immediate sync if online
    if (navigator.onLine) {
      setTimeout(() => this.sync(), 1000);
    }
  }

  // Clear completed items from queue
  async clearCompleted(): Promise<void> {
    await offlineDB.syncQueue.clearCompleted();
  }

  // Retry failed items
  async retryFailed(): Promise<void> {
    const failedItems = await offlineDB.syncQueue.getAll();
    const failed = failedItems.filter(item => item.status === 'failed');

    for (const item of failed) {
      if (item.id) {
        await offlineDB.syncQueue.update(item.id, { status: 'pending' });
      }
    }

    await this.sync();
  }

  // Get/Set last sync time
  private getLastSyncTime(): Date | null {
    const timeStr = localStorage.getItem('lastSyncTime');
    return timeStr ? new Date(timeStr) : null;
  }

  private setLastSyncTime(time: Date): void {
    localStorage.setItem('lastSyncTime', time.toISOString());
  }

  // Download exams for offline use
  async downloadExamsForOffline(examIds: number[]): Promise<void> {
    console.log(`📥 Downloading ${examIds.length} exams for offline use...`);

    for (const examId of examIds) {
      try {
        const { data: examData } = await examApi.getById(examId);
        const { data: questionsData } = await examApi.getQuestions(examId);

        await offlineDB.exams.add({
          ...examData.data,
          syncStatus: 'synced',
          lastModified: new Date(),
        });

        await offlineDB.questions.bulkAdd(questionsData.data);

        console.log(`✅ Downloaded exam ${examId}`);
      } catch (error) {
        console.error(`❌ Failed to download exam ${examId}:`, error);
      }
    }
  }
}

// Export singleton instance
export const offlineSync = new OfflineSyncService();

export default offlineSync;
