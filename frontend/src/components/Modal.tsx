import React, { useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  fullScreen = false,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = fullScreen
    ? {
        backgroundColor: "var(--surface)",
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        borderRadius: "0",
        padding: "0",
        overflow: "auto",
        position: "relative",
        boxShadow: "none",
      }
    : {
        backgroundColor: "var(--surface)",
        borderRadius: "8px",
        padding: "20px",
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflow: "auto",
        position: "relative",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text)",
    margin: 0,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    fontSize: "24px",
    color: "var(--text-h)",
    cursor: "pointer",
    padding: "0",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "background-color 0.2s",
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <style>{`
        .modal-close-btn:hover {
          background-color: var(--bg-hover);
        }
      `}</style>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <button
              onClick={onClose}
              style={closeButtonStyle}
              className="modal-close-btn"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            style={{
              ...closeButtonStyle,
              position: "absolute",
              top: "12px",
              right: "12px",
            }}
            className="modal-close-btn"
            aria-label="Close modal"
          >
            ×
          </button>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};
