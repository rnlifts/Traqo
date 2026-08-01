import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { ConfirmDialog } from './ConfirmDialog';
import { GridIcon, ClipboardIcon, HistoryIcon, LogoutIcon } from './icons';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: GridIcon },
  { path: '/workout-plans', label: 'Plans', Icon: ClipboardIcon },
  { path: '/workout-history', label: 'History', Icon: HistoryIcon },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser } = useAuth();
  const { hasUnsavedChanges } = useUnsavedChanges();
  const [dropdownOpen, setDropdownOpen] = useState(false); // Avatar dropdown on mobile
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = (path: string, e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      setPendingNavTarget(path);
    }
    setDropdownOpen(false);
  };

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const initial = currentUser?.display_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <Link to="/dashboard" className="sidebar-brand">
          TRA<span className="brand-accent">QO</span>
        </Link>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="avatar-btn"
            aria-label="User menu"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px',
            }}
          >
            {initial}
          </button>
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                minWidth: '200px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                  {currentUser?.display_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.7, marginTop: '4px', fontFamily: 'monospace' }}>
                  @{currentUser?.username}
                </div>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '16px' }}>⎋</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar-brand sidebar-brand-desktop">
          TRA<span className="brand-accent">QO</span>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map(({ path, label, Icon }) => (
            <Link
              key={path}
              to={path}
              className={`sidebar-link${isActivePath(path) ? ' active' : ''}`}
              aria-current={isActivePath(path) ? 'page' : undefined}
              onClick={(e) => handleNavClick(path, e)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar">{initial}</span>
            <div style={{ flex: 1 }}>
              <div>{currentUser?.display_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.7, marginTop: '4px', fontFamily: 'monospace' }}>
                @{currentUser?.username}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout">
            <LogoutIcon size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="app-content">{children}</main>

      {/* Mobile bottom navigation bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map(({ path, label, Icon }) => (
          <Link
            key={path}
            to={path}
            className={`bottom-nav-item${isActivePath(path) ? ' active' : ''}`}
            aria-current={isActivePath(path) ? 'page' : undefined}
            onClick={(e) => handleNavClick(path, e)}
          >
            <Icon size={24} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <ConfirmDialog
        isOpen={pendingNavTarget !== null}
        title="Leave without saving?"
        message="You're in the middle of creating a plan. Leaving now will lose your progress."
        confirmText="Leave"
        cancelText="Stay"
        isDangerous={true}
        onConfirm={() => {
          if (pendingNavTarget) {
            navigate(pendingNavTarget);
          }
          setPendingNavTarget(null);
        }}
        onCancel={() => setPendingNavTarget(null)}
      />
    </div>
  );
};
