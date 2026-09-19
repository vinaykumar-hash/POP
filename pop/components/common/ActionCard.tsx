import React from 'react';
import Link from 'next/link';

interface ActionCardProps {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  to: string;
}

export default function ActionCard({
  id,
  title,
  description,
  buttonText,
  to,
}: ActionCardProps) {
  return (
    <Link
      href={to}
      id={id}
      className="action-card"
      aria-label={`${title} - ${description}`}
    >
      <div className="card-content-top">
        <h2 className="card-title">{title}</h2>
        <p className="card-description">{description}</p>
      </div>

      <div className="card-action-bottom">
        <span className="btn btn-primary" id={`${id}-btn`}>
          {buttonText}
        </span>
        <span className="card-arrow" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
