import React from 'react';
import Loading from './Loading';
import useLoadingStore from '../store/loadingStore';

const GlobalLoadingOverlay: React.FC = () => {
  const isLoading = useLoadingStore((state) => state.isLoading);

  if (!isLoading) {
    return null;
  }

  return <Loading fullScreen message="Loading..." />;
};

export default GlobalLoadingOverlay;