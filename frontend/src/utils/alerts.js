import Swal from 'sweetalert2';

// Custom theme colors: blue (#2563eb), green (#16a34a), red (#dc2626)
// Background: white, Text: gray-800 (#1f2937)

// Success alert
export const showSuccess = (message, title = 'Success!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#16a34a', // green-600
    background: '#ffffff',
    color: '#1f2937', // gray-800
    timer: 2500,
    timerProgressBar: true,
  });
};

// Error alert
export const showError = (message, title = 'Error!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#dc2626', // red-600
    background: '#ffffff',
    color: '#1f2937',
  });
};

// Warning alert
export const showWarning = (message, title = 'Warning!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#2563eb', // blue-600
    background: '#ffffff',
    color: '#1f2937',
  });
};

// Info alert
export const showInfo = (message, title = 'Info') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#2563eb', // blue-600
    background: '#ffffff',
    color: '#1f2937',
  });
};

// Confirmation dialog
export const showConfirm = (message, title = 'Are you sure?') => {
  return Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonColor: '#2563eb', // blue-600
    cancelButtonColor: '#dc2626', // red-600
    confirmButtonText: 'Yes, proceed!',
    cancelButtonText: 'Cancel',
    background: '#ffffff',
    color: '#1f2937',
  });
};

// Delete confirmation
export const showDeleteConfirm = (itemName = 'this item') => {
  return Swal.fire({
    icon: 'warning',
    title: 'Delete Confirmation',
    text: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    showCancelButton: true,
    confirmButtonColor: '#dc2626', // red-600
    cancelButtonColor: '#6b7280', // gray-500
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    background: '#ffffff',
    color: '#1f2937',
  });
};

// Loading alert
export const showLoading = (message = 'Processing...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: '#ffffff',
    color: '#1f2937',
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
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#ffffff',
    color: '#1f2937',
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
    confirmButtonColor: '#2563eb', // blue-600
    cancelButtonColor: '#6b7280', // gray-500
    background: '#ffffff',
    color: '#1f2937',
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
