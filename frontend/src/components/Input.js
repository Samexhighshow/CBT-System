import React from 'react';

const Input = ({
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const errorStyles = error ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500';
  const disabledStyles = disabled ? 'bg-gray-100 cursor-not-allowed' : '';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <div className={`flex flex-col gap-2 ${widthStyle}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${baseStyles} ${errorStyles} ${disabledStyles} ${className}`}
        {...props}
      />
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  );
};

export default Input;
