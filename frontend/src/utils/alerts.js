import Swal from 'sweetalert2';

/**
 * SweetAlert2 Utility Functions
 * Centralized alert handling for consistent UI/UX
 */

// Success alert
export const showSuccess = (message, title = 'Success!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#3085d6',
    timer: 3000,
    timerProgressBar: true,
  });
};

// Error alert
export const showError = (message, title = 'Error!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#d33',
  });
};

// Warning alert
export const showWarning = (message, title = 'Warning!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#f0ad4e',
  });
};

// Info alert
export const showInfo = (message, title = 'Info') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#5bc0de',
  });
};

// Confirmation dialog
export const showConfirm = (message, title = 'Are you sure?') => {
  return Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, proceed!',
    cancelButtonText: 'Cancel',
  });
};

// Delete confirmation
export const showDeleteConfirm = (itemName = 'this item') => {
  return Swal.fire({
    icon: 'warning',
    title: 'Delete Confirmation',
    text: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
  });
};

// Loading alert
export const showLoading = (message = 'Processing...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
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
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#6c757d',
    inputValidator: (value) => {
      if (!value) {
        return 'You need to enter something!';
      }
    },
  });
};

export default {
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
