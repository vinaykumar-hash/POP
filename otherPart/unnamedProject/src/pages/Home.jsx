import React from 'react';
import ActionCard from '../components/ActionCard';

export default function Home() {
  return (
    <section className="home-container" aria-labelledby="home-heading">
      <div className="page-header-section">
        <h1 id="home-heading" className="page-title">
          Parking, made simple.
        </h1>
        <p className="text-subtitle page-subtitle">
          Find a parking spot or list your unused space.
        </p>
      </div>

      <div className="cards-grid" role="region" aria-label="Main parking options">
        <ActionCard
          id="card-find-parking"
          title="Find Parking"
          description="Find an open parking spot or rent a private parking space."
          buttonText="Find Parking"
          to="/find"
        />
        <ActionCard
          id="card-list-parking"
          title="List Parking"
          description="List your unused parking space and let others rent it."
          buttonText="List Parking"
          to="/list"
        />
      </div>
    </section>
  );
}
