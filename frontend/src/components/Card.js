import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  className = '',
  clickable = false,
  onClick = null
}) => {
  const baseStyles = 'bg-white rounded-lg shadow-md p-6 transition-all duration-200';
  const hoverStyles = clickable ? 'hover:shadow-lg cursor-pointer' : '';

  return (
    <div
      className={`${baseStyles} ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
