import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Loading from './Loading';

const MIN_DISPLAY_MS = 250;

const RouteTransitionLoader: React.FC = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const timer = window.setTimeout(() => {
      if (active) {
        setIsLoading(false);
      }
    }, MIN_DISPLAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.search, location.hash]);

  if (!isLoading) {
    return null;
  }

  return <Loading fullScreen message="Loading page..." />;
};

export default RouteTransitionLoader;