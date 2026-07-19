import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>
        <div style={styles.buttons}>
          <button
            onClick={onCancel}
            style={{...styles.btn, ...styles.btnSecondary}}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              ...styles.btn,
              ...(isDangerous ? styles.btnDanger : styles.btnPrimary),
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '400px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 'bold' as const,
  },
  message: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: 'var(--text)',
    lineHeight: '1.5',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  btn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    transition: 'background-color 0.2s',
  },
  btnPrimary: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  btnSecondary: {
    backgroundColor: 'var(--border)',
    color: 'var(--text-h)',
  },
  btnDanger: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
};
