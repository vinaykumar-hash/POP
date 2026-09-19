import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="app-header" role="banner">
      <div className="header-container">
        <Link
          to={isAuthenticated ? (user?.groups?.includes('admin') ? '/admin/listings' : '/host/dashboard') : '/'}
          className="brand-logo"
          id="nav-brand-logo"
          aria-label="ParkSync Home"
        >
          <span className="brand-badge" aria-hidden="true">P</span>
          <span>ParkSync</span>
        </Link>
        <nav className="nav-actions" aria-label="Main Navigation">
          {!isAuthenticated ? (
            <>
              <NavLink
                to="/find"
                id="nav-link-find"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Find Parking
              </NavLink>
              <NavLink
                to="/list"
                id="nav-link-list"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                List Parking
              </NavLink>
            </>
          ) : (
            <div className="nav-auth-section">
              <Link
                to={user?.groups?.includes('admin') ? '/admin/listings' : '/host/dashboard'}
                className="nav-host-pill"
                title={`Host ID: ${user?.id}`}
                style={{ textDecoration: 'none' }}
              >
                <span className="host-indicator-dot" aria-hidden="true"></span>
                <span className="nav-host-name">{user?.name || 'Host Account'}</span>
              </Link>
              <button
                type="button"
                id="btn-nav-signout"
                className="btn-nav-signout"
                onClick={handleSignOut}
                aria-label="Sign out of host account"
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
