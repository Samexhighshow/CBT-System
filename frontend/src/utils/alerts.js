import Swal from 'sweetalert2';

// Dark theme colors matching the new UI
// Background: slate-800 (#1e293b), Text: gray-100 (#f3f4f6)
// Accent: emerald-500 (#10b981), Error: red-500 (#ef4444), Warning: amber-500 (#f59e0b)

// Custom dark theme base config
const darkThemeConfig = {
  background: '#1e293b', // slate-800
  color: '#f3f4f6', // gray-100
  customClass: {
    popup: 'dark-swal-popup',
    title: 'dark-swal-title',
    htmlContainer: 'dark-swal-content',
    confirmButton: 'dark-swal-confirm',
    cancelButton: 'dark-swal-cancel',
  },
};

// Success alert
export const showSuccess = (message, title = 'Success!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#10b981', // emerald-500
    ...darkThemeConfig,
    timer: 2500,
    timerProgressBar: true,
    iconColor: '#10b981',
  });
};

// Error alert
export const showError = (message, title = 'Error!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#ef4444', // red-500
    ...darkThemeConfig,
    iconColor: '#ef4444',
  });
};

// Warning alert
export const showWarning = (message, title = 'Warning!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#f59e0b', // amber-500
    ...darkThemeConfig,
    iconColor: '#f59e0b',
  });
};

// Info alert
export const showInfo = (message, title = 'Info') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#3b82f6', // blue-500
    ...darkThemeConfig,
    iconColor: '#3b82f6',
  });
};

// Confirmation dialog
export const showConfirm = (message, title = 'Are you sure?') => {
  return Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonColor: '#10b981', // emerald-500
    cancelButtonColor: '#64748b', // slate-500
    confirmButtonText: 'Yes, proceed!',
    cancelButtonText: 'Cancel',
    ...darkThemeConfig,
    iconColor: '#3b82f6',
  });
};

// Delete confirmation
export const showDeleteConfirm = (itemName = 'this item') => {
  return Swal.fire({
    icon: 'warning',
    title: 'Delete Confirmation',
    text: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // red-500
    cancelButtonColor: '#64748b', // slate-500
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    ...darkThemeConfig,
    iconColor: '#ef4444',
  });
};

// Loading alert
export const showLoading = (message = 'Processing...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    ...darkThemeConfig,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

// Close loading
export const closeLoading = () => {
  Swal.close();
};

// Toast notification (non-blocking)
export const showToast = (message, icon = 'success') => {
  const iconColors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e293b',
    color: '#f3f4f6',
    iconColor: iconColors[icon] || '#10b981',
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon,
    title: message,
  });
};

// Input dialog
export const showInput = (title, inputType = 'text', inputLabel = '') => {
  return Swal.fire({
    title,
    input: inputType,
    inputLabel,
    showCancelButton: true,
    confirmButtonColor: '#10b981', // emerald-500
    cancelButtonColor: '#64748b', // slate-500
    ...darkThemeConfig,
    inputValidator: (value) => {
      if (!value) {
        return 'You need to enter something!';
      }
    },
  });
};

const alerts = {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  showDeleteConfirm,
  showLoading,
  closeLoading,
  showToast,
  showInput,
};

export default alerts;
