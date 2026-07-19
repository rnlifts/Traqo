import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/exercises', label: 'Exercises' },
    { path: '/workout-plans', label: 'Plans' },
    { path: '/workout-history', label: 'History' },
  ];

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <div>
      <nav style={styles.navbar}>
        <div style={styles.navContainer}>
          <Link to="/dashboard" style={styles.navBrand}>
            Traqo
          </Link>

          {/* Desktop nav */}
          <div className="nav-desktop" style={styles.navLinks}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navLink,
                  ...(isActivePath(item.path)
                    ? styles.navLinkActive
                    : {}),
                }}
                aria-current={isActivePath(item.path) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}

            <span style={styles.navSeparator}>|</span>

            <span style={styles.navUser}>
              {currentUser?.display_name}
            </span>

            <button
              onClick={handleLogout}
              className="btn btn-danger"
              style={{...styles.logoutBtn, ...styles.btn}}
            >
              Logout
            </button>
          </div>

          {/* Hamburger button for mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={styles.hamburger}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div style={styles.mobileMenu}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.mobileMenuItem,
                  ...(isActivePath(item.path)
                    ? styles.mobileMenuItemActive
                    : {}),
                }}
                onClick={() => setMenuOpen(false)}
                aria-current={isActivePath(item.path) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
            <span style={styles.mobileSeparator} />
            <span style={styles.mobileUser}>
              {currentUser?.display_name}
            </span>
            <button
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
              className="btn btn-danger"
              style={{...styles.mobileLogoutBtn, ...styles.btn}}
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      <div style={styles.pageContent}>
        {children}
      </div>
    </div>
  );
};

const styles = {
  navbar: {
    backgroundColor: 'var(--nav-bg)',
    color: 'white',
    borderBottom: `1px solid var(--border)`,
    marginBottom: '20px',
  } as React.CSSProperties,
  navContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '56px',
  } as React.CSSProperties,
  navBrand: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    textDecoration: 'none',
  } as React.CSSProperties,
  navLinks: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  } as React.CSSProperties,
  navLink: {
    color: 'white',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  navLinkActive: {
    backgroundColor: 'var(--accent)',
    fontWeight: 'bold' as const,
  } as React.CSSProperties,
  navSeparator: {
    color: 'rgba(255, 255, 255, 0.3)',
  } as React.CSSProperties,
  navUser: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
  } as React.CSSProperties,
  logoutBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  } as React.CSSProperties,
  hamburger: {
    display: 'none',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  } as React.CSSProperties,
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '12px 20px',
    borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
    gap: '8px',
  } as React.CSSProperties,
  mobileMenuItem: {
    color: 'white',
    textDecoration: 'none',
    padding: '12px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  mobileMenuItemActive: {
    backgroundColor: 'var(--accent)',
    fontWeight: 'bold' as const,
  } as React.CSSProperties,
  mobileSeparator: {
    borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
    margin: '8px 0',
  } as React.CSSProperties,
  mobileUser: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    padding: '12px',
  } as React.CSSProperties,
  mobileLogoutBtn: {
    width: '100%',
    margin: '8px 0 0 0',
  } as React.CSSProperties,
  pageContent: {
    padding: '20px',
  } as React.CSSProperties,
  btn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  } as React.CSSProperties,
};
