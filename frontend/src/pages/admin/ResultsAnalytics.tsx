import React from 'react';
import { Card } from '../../components';

const ResultsAnalytics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Results & Analytics</h1>
        <p className="text-gray-600 mt-2">View exam results and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Average Score</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">75.5%</h3>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">Pass Rate</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">82%</h3>
        </Card>
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">Submissions</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">1,250</h3>
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
