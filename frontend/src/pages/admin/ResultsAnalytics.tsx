import React, { useState, useEffect } from 'react';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';

interface AnalyticsData {
  average_score: number;
  pass_rate: number;
  total_submissions: number;
}

const ResultsAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    average_score: 0,
    pass_rate: 0,
    total_submissions: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/results/analytics');
      if (response.data) {
        setAnalytics(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Don't show error, just use default empty state
      setAnalytics({
        average_score: 0,
        pass_rate: 0,
        total_submissions: 0,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Results & Analytics</h1>
        <p className="text-gray-600 mt-2">View exam results and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Average Score</p>
            <h3 className="text-2xl font-bold text-green-600 mt-1">
              {loading ? '...' : `${Number(analytics.average_score ?? 0).toFixed(1)}%`}
            </h3>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">Pass Rate</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">
              {loading ? '...' : `${Number(analytics.pass_rate ?? 0).toFixed(1)}%`}
            </h3>
        </Card>
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">Submissions</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">
              {loading ? '...' : Number(analytics.total_submissions ?? 0).toLocaleString()}
            </h3>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
        <p className="text-gray-500">Charts and analytics will appear here</p>
      </Card>
    </div>
  );
};

export default ResultsAnalytics;
