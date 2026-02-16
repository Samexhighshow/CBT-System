import { examApi } from './laravelApi';
import offlineDB, { ExamPackage } from './offlineDB';
import { checkReachability } from './reachability';

interface RefreshSummary {
  total: number;
  refreshed: number;
  failed: number;
}

const normalizePackage = (payload: any) => payload?.data ?? payload;

export const offlineCacheUpdater = {
  async refreshAllCachedExamPackages(): Promise<RefreshSummary> {
    const reachability = await checkReachability();
    if (reachability.status === 'OFFLINE') {
      return { total: 0, refreshed: 0, failed: 0 };
    }

    const cached = await offlineDB.examPackages.toArray();
    const examIds = cached.map((pkg) => pkg.examId);

    if (examIds.length === 0) {
      return { total: 0, refreshed: 0, failed: 0 };
    }

    let refreshed = 0;
    let failed = 0;

    for (const examId of examIds) {
      try {
        const response = await examApi.getPackage(examId);
        const pkg = normalizePackage(response.data);

        const payload: ExamPackage = {
          examId,
          downloadedAt: new Date().toISOString(),
          packageVersion: String(pkg?.packageVersion || pkg?.version || '1'),
          data: pkg,
        };

        await offlineDB.examPackages.put(payload);
        refreshed += 1;
      } catch (error) {
        console.error('Failed to refresh exam package:', examId, error);
        failed += 1;
      }
    }

    return { total: examIds.length, refreshed, failed };
  },
};

export default offlineCacheUpdater;
