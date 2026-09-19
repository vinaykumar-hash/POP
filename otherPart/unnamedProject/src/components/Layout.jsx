import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content" role="main">
        {children}
      </main>
      <footer className="app-footer" role="contentinfo">
        <div className="footer-container">
          <span>ParkSync &copy; {new Date().getFullYear()}</span>
          <span>Urban parking made seamless</span>
        </div>
      </footer>
    </div>
  );
}
