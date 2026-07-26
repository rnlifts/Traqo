import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { ConfirmDialog } from './ConfirmDialog';
import { GridIcon, DumbbellIcon, ClipboardIcon, HistoryIcon, LogoutIcon } from './icons';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: GridIcon },
  { path: '/exercises', label: 'Exercises', Icon: DumbbellIcon },
  { path: '/workout-plans', label: 'Plans', Icon: ClipboardIcon },
  { path: '/workout-history', label: 'History', Icon: HistoryIcon },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser } = useAuth();
  const { hasUnsavedChanges } = useUnsavedChanges();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = (path: string, e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      setPendingNavTarget(path);
    }
    setMenuOpen(false);
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
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="hamburger-btn"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      <aside
        className={`sidebar${menuOpen ? ' open' : ''}`}
        style={menuOpen ? { transform: 'translateX(0)' } : undefined}
      >
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

      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="app-content">{children}</main>

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
