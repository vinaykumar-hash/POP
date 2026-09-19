import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ActionCard from '../components/ActionCard';

export default function ListParking() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/host/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <section className="list-parking-container" aria-labelledby="list-parking-heading">
      <div className="back-navigation">
        <button
          type="button"
          className="btn-back"
          id="btn-back-list"
          onClick={() => navigate('/')}
          aria-label="Back to home"
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
          <span>Back</span>
        </button>
      </div>

      <div className="page-header-section">
        <h1 id="list-parking-heading" className="page-title">
          Are you new to ParkSync?
        </h1>
        <p className="text-subtitle page-subtitle">
          Turn your unused parking spot into income or manage existing listings.
        </p>
      </div>

      <div className="cards-grid" role="region" aria-label="Host listing options">
        <ActionCard
          id="card-host-new"
          title="I'm New"
          description="Create your first parking listing."
          buttonText="Create Listing"
          to="/host/signup"
        />
        <ActionCard
          id="card-host-existing"
          title="I'm an Existing Host"
          description="Manage your parking listings and bookings."
          buttonText="Manage My Parking"
          to="/host/login"
        />
      </div>
    </section>
  );
}
