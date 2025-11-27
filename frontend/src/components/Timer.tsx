import React from 'react';

interface TimerProps {
  timeRemaining: number;
  duration: number;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining, duration }) => {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = (timeRemaining / duration) * 100;
  
  const isWarning = timeRemaining < 300; // 5 minutes
  const isCritical = timeRemaining < 60; // 1 minute

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-3xl font-bold tabular-nums ${
        isCritical ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-blue-600'
      }`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${
            isCritical ? 'bg-red-600' : isWarning ? 'bg-orange-600' : 'bg-green-600'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {isCritical && (
        <p className="text-xs text-red-600 font-semibold">Less than 1 minute remaining</p>
      )}
    </div>
  );
};

export default Timer;
