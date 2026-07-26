import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: { backgroundColor: '#28a745', color: 'white' },
    error: { backgroundColor: '#dc3545', color: 'white' },
    info: { backgroundColor: '#17a2b8', color: 'white' },
  };

  return (
    <div style={{ ...styles.toast, ...typeStyles[type] }}>
      {message}
    </div>
  );
};

export const useToast = () => {
  const [toast, setToast] = React.useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const closeToast = React.useCallback(() => {
    setToast(null);
  }, []);

  return {
    Toast: toast ? (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />
    ) : null,
    showToast,
  };
};

const styles = {
  toast: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    padding: '16px 20px',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 2000,
    maxWidth: '400px',
    fontSize: '14px',
    animation: 'slideIn 0.3s ease-in-out',
  },
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
