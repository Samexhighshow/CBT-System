import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CbtAccessPortal from './pages/CbtAccessPortal';
import CbtExamSession from './pages/CbtExamSession';

const CbtInterfaceApp: React.FC = () => {
  return (
    <Routes>
      <Route index element={<CbtAccessPortal />} />
      <Route path="attempt/:attemptId" element={<CbtExamSession />} />
      <Route path="*" element={<Navigate to="/cbt" replace />} />
    </Routes>
  );
};

export default CbtInterfaceApp;
