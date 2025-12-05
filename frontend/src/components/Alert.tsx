import React from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type?: AlertType;
  title?: string;
  message?: string;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose
}) => {
  const typeStyles: Record<AlertType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const iconMap: Record<AlertType, string> = {
    success: 'bx-check-circle',
    error: 'bx-error-circle',
    warning: 'bx-error',
    info: 'bx-info-circle'
  };

  return (
    <div className={`border rounded-lg p-4 flex gap-3 items-start ${typeStyles[type]}`}>
      <i className={`bx ${iconMap[type]} text-xl font-bold flex-shrink-0`}></i>
      
      <div className="flex-1">
        {title && <h4 className="font-semibold">{title}</h4>}
        {message && <p className="text-sm mt-1">{message}</p>}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-lg font-bold hover:opacity-70 flex-shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
