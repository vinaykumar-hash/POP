import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PlaceholderPage({
  title,
  subtitle,
  badge = "Step 1 Placeholder",
  backTo = "/",
  backLabel = "Back",
  pageId = "placeholder-page"
}) {
  const navigate = useNavigate();

  return (
    <section className="placeholder-container" id={pageId} aria-labelledby={`${pageId}-title`}>
      <div className="back-navigation">
        <button
          type="button"
          className="btn-back"
          id={`${pageId}-btn-back`}
          onClick={() => navigate(backTo)}
          aria-label={`Go back to ${backLabel}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          <span>{backLabel}</span>
        </button>
      </div>

      <span className="placeholder-badge">{badge}</span>

      <div className="page-header-section">
        <h1 id={`${pageId}-title`} className="page-title">
          {title}
        </h1>
        <p className="text-subtitle page-subtitle">
          {subtitle}
        </p>
      </div>

      <div className="placeholder-card">
        <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.5rem' }}>
          Coming in future steps
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          This route is set up as part of the initial Step 1 navigation architecture. Full functionality will be enabled when its respective step is implemented.
        </p>
        <div className="placeholder-notice">
          Navigation route active &bull; Clean state ready for integration
        </div>
      </div>
    </section>
  );
}
