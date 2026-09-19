'use client';

import Link from 'next/link';
import type { ParkingSearchResult, CurrentAvailability } from '@/types/parking';
import { formatDistance, formatDuration } from '@/services/geo/haversine';
import { openGoogleMapsNavigation } from '@/services/navigation/googleMapsService';
import AvailabilityBadge from './AvailabilityBadge';
import OccupancyChart from './OccupancyChart';
import CrowdsourceReporter from './CrowdsourceReporter';
import { SpotAlertButton } from './SpotAlertButton';
import {
  IconPin,
  IconCar,
  IconCapacity,
  IconArea,
  IconCurrencyRupee,
  IconClock,
  IconDocument,
  IconCovered,
  IconEvCharging,
  IconCctv,
  IconSecurity,
  IconLighting,
  IconAccessibility,
  IconRestroom,
  IconTwoWheeler,
  IconBicycle,
  IconHeavyVehicle,
  IconNavigation,
  IconClose,
  IconSparkles,
} from '@/components/common/Icons';

interface ParkingDetailsProps {
  result: ParkingSearchResult;
  onClose: () => void;
  onAvailabilityUpdated?: (newAvailability: CurrentAvailability) => void;
}

const TYPE_LABELS: Record<string, string> = {
  FREE: 'Free Parking',
  PAID: 'Paid Parking',
  PUBLIC: 'Public Parking',
  GARAGE: 'Parking Garage',
  OPEN: 'Open Parking',
};

const SOURCE_LABELS: Record<string, string> = {
  OSM: 'OpenStreetMap',
  OPENCITY: 'OpenCity Bengaluru',
  USER: 'User Reported',
  HOST: 'Private Host',
  OTHER: 'Public Data',
};

export default function ParkingDetails({
  result,
  onClose,
  onAvailabilityUpdated,
}: ParkingDetailsProps) {
  const { parking, straightLineDistance, roadDistance, estimatedDriveTime } = result;
  const availability = parking.currentAvailability;
  const facilities = parking.facilities;
  const rawMeta = (parking.sourceMetadata || {}) as Record<string, any>;
  const rawArea =
    parking.areaSquareMeters ??
    rawMeta.areaSquareMeters ??
    rawMeta.estimatedAreaM2;

  const handleDirections = () => {
    openGoogleMapsNavigation(
      parking.latitude,
      parking.longitude,
      parking.name
    );
  };

  return (
    <div
      className="parking-details-scrollable pw-scrollbar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '22px',
      }}
    >
      {/* SECTION 1: HEADER & COMMUTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className={`type-badge type-${parking.type.toLowerCase()}`}>
                {TYPE_LABELS[parking.type] || parking.type}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--pw-text-tertiary)',
                  padding: '2px 8px',
                  background: 'var(--pw-bg)',
                  borderRadius: 'var(--pw-radius-full)',
                  border: '1px solid var(--pw-border)',
                }}
              >
                {SOURCE_LABELS[parking.source] || parking.source}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--pw-text)',
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
              }}
            >
              {parking.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pw-btn pw-btn-icon pw-btn-secondary"
            style={{
              flexShrink: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close details"
          >
            <IconClose size={15} />
          </button>
        </div>

        {/* Distance & Travel Time Pills */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--pw-text-secondary)',
              background: 'var(--pw-bg)',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--pw-border)',
            }}
          >
            <IconPin size={13} style={{ color: 'var(--pw-primary)' }} />
            <span>{formatDistance(straightLineDistance)} away</span>
          </div>

          {roadDistance !== undefined && estimatedDriveTime !== undefined && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--pw-text-secondary)',
                background: 'var(--pw-bg)',
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid var(--pw-border)',
              }}
            >
              <IconCar size={14} style={{ color: 'var(--pw-accent)' }} />
              <span>
                {formatDistance(roadDistance)} · {formatDuration(estimatedDriveTime)} drive
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: LIVE OCCUPANCY & AVAILABILITY */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="pw-section-header">
          LIVE AVAILABILITY
        </div>
        <div
          style={{
            background: 'var(--pw-surface)',
            border: '1px solid var(--pw-border)',
            borderRadius: 'var(--pw-radius)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pw-text)' }}>
              Current Status
            </span>
            <AvailabilityBadge
              status={availability?.status ?? 'UNKNOWN'}
              confidence={availability?.confidence}
              showConfidence
            />
          </div>

          {/* Probability Gauge for Next Incoming Driver */}
          {availability?.confidence !== undefined && availability.confidence > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px 12px',
                background: 'var(--pw-bg)',
                borderRadius: '8px',
                border: '1px solid var(--pw-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--pw-text)' }}>
                  Next Driver Chance of Getting a Spot
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      availability.confidence >= 65
                        ? '#059669'
                        : availability.confidence >= 35
                        ? '#d97706'
                        : '#dc2626',
                  }}
                >
                  {availability.confidence}% Chance
                </span>
              </div>

              {/* Probability Bar */}
              <div
                style={{
                  height: '6px',
                  width: '100%',
                  background: 'var(--pw-border)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(5, availability.confidence))}%`,
                    background:
                      availability.confidence >= 65
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : availability.confidence >= 35
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #f87171, #dc2626)',
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
                <span>
                  {availability.confidence >= 65
                    ? 'High probability — plenty of open spaces'
                    : availability.confidence >= 35
                    ? 'Moderate probability — spots filling up'
                    : 'Low probability — lot nearly or completely full'}
                </span>
                {availability.availableSpaces !== undefined && (
                  <span style={{ fontWeight: 600 }}>~{availability.availableSpaces} open</span>
                )}
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--pw-text-secondary)', lineHeight: 1.5 }}>
            {availability?.source === 'NONE' || !availability
              ? 'No live driver reports yet. Real-time availability is updated as POP users reach this location.'
              : availability.source === 'CROWDSOURCED'
              ? 'Calculated from real-time driver parking signals and GPS dwell. As drivers park or leave, this probability updates for incoming drivers.'
              : availability.source === 'CONFIRMED'
              ? 'Directly confirmed on-site by a POP driver in Bengaluru.'
              : 'Estimated from municipal baseline data and daytime patterns.'}
          </p>

          {availability?.availableSpaces !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px dashed var(--pw-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--pw-accent)' }}>
                  ~{availability.availableSpaces}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--pw-text-tertiary)' }}>
                  estimated open spaces
                </span>
              </div>
              {rawArea && rawArea > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)' }}>
                  Total capacity: ~{parking.capacity || Math.floor(rawArea / 28)}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: KEY SPECIFICATIONS */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="pw-section-header">
          KEY SPECIFICATIONS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}
        >
          <SpecCard
            label="Area"
            value={
              rawArea && rawArea > 0
                ? `${Math.round(rawArea).toLocaleString()} m²`
                : parking.capacity !== undefined
                ? `${parking.capacity} spaces`
                : 'Point location'
            }
            icon={<IconArea size={16} />}
          />
          <SpecCard
            label="Pricing"
            value={
              parking.pricePerHour !== undefined && parking.pricePerHour > 0
                ? `₹${parking.pricePerHour}/hr`
                : parking.type === 'FREE'
                ? 'Free'
                : 'Check on site'
            }
            icon={
              parking.type === 'FREE' ? (
                <IconSparkles size={16} />
              ) : (
                <IconCurrencyRupee size={16} />
              )
            }
          />
          <SpecCard
            label="Hours"
            value={
              parking.openingTime && parking.closingTime
                ? `${parking.openingTime} – ${parking.closingTime}`
                : 'Check on site'
            }
            icon={<IconClock size={16} />}
          />
          <SpecCard
            label="Data Provider"
            value={SOURCE_LABELS[parking.source] || parking.source}
            icon={<IconDocument size={16} />}
          />
        </div>
      </section>

      {/* SECTION 4: FACILITIES & AMENITIES */}
      {facilities && Object.values(facilities).some(Boolean) && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="pw-section-header">
            FACILITIES & AMENITIES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {facilities.covered && (
              <FacilityTag icon={<IconCovered size={13} />} label="Covered Canopy" />
            )}
            {facilities.evCharging && (
              <FacilityTag icon={<IconEvCharging size={13} />} label="EV Charging" />
            )}
            {facilities.cctv && (
              <FacilityTag icon={<IconCctv size={13} />} label="CCTV" />
            )}
            {facilities.security && (
              <FacilityTag icon={<IconSecurity size={13} />} label="Security" />
            )}
            {facilities.lighting && (
              <FacilityTag icon={<IconLighting size={13} />} label="Night Lighting" />
            )}
            {facilities.wheelchairAccessible && (
              <FacilityTag icon={<IconAccessibility size={13} />} label="Accessible" />
            )}
            {facilities.restroom && (
              <FacilityTag icon={<IconRestroom size={13} />} label="Restroom" />
            )}
          </div>
        </section>
      )}

      {/* SECTION 5: SUPPORTED VEHICLES */}
      {parking.vehicleTypes && parking.vehicleTypes.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="pw-section-header">
            SUPPORTED VEHICLES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {parking.vehicleTypes.includes('CAR') && (
              <FacilityTag icon={<IconCar size={13} />} label="Four-Wheeler / Car" />
            )}
            {parking.vehicleTypes.includes('TWO_WHEELER') && (
              <FacilityTag icon={<IconTwoWheeler size={13} />} label="Two-Wheeler / Bike" />
            )}
            {parking.vehicleTypes.includes('BICYCLE') && (
              <FacilityTag icon={<IconBicycle size={13} />} label="Bicycle" />
            )}
            {parking.vehicleTypes.includes('HEAVY') && (
              <FacilityTag icon={<IconHeavyVehicle size={13} />} label="Heavy Vehicle" />
            )}
          </div>
        </section>
      )}

      {/* SECTION 6: DRIVER COMMUNITY UPDATES */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="pw-section-header">
          COMMUNITY DRIVER REPORTING
        </div>
        <CrowdsourceReporter
          parkingId={parking.id}
          parkingName={parking.name}
          onAvailabilityUpdated={onAvailabilityUpdated}
          compact={true}
        />
      </section>

      {/* SECTION 7: OCCUPANCY INSIGHTS */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="pw-section-header">
          OCCUPANCY INSIGHTS
        </div>
        <OccupancyChart parking={parking} compact={true} />
      </section>

      {/* SECTION 8: SMART SPOT ALERT */}
      <SpotAlertButton
        parkingId={parking.id}
        parkingName={parking.name}
        status={availability?.status || 'UNKNOWN'}
      />

      {/* SECTION 9: LOCATION & NAVIGATION ACTIONS */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingTop: '8px',
          borderTop: '1px solid var(--pw-border)',
        }}
      >
        <div className="pw-section-header">
          LOCATION & NAVIGATION
        </div>

        {parking.address && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--pw-text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <IconPin size={14} style={{ color: 'var(--pw-text-tertiary)', flexShrink: 0, marginTop: '2px' }} />
            <span>{parking.address}</span>
          </div>
        )}

        {parking.description && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--pw-text-tertiary)', fontStyle: 'italic', lineHeight: 1.4 }}>
            {parking.description}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            className="pw-btn pw-btn-accent"
            onClick={handleDirections}
            style={{
              width: '100%',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
            id="directions-button"
          >
            <IconNavigation size={15} />
            <span>Get Directions</span>
          </button>

          <Link
            href={`/parking/${parking.id}`}
            className="pw-btn pw-btn-secondary"
            style={{
              width: '100%',
              textAlign: 'center',
              textDecoration: 'none',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
            id="full-details-button"
          >
            <IconDocument size={14} />
            <span>View Full Details Page</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function SpecCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--pw-surface)',
        border: '1px solid var(--pw-border)',
        borderRadius: 'var(--pw-radius)',
        padding: '12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <div
        style={{
          color: 'var(--pw-primary)',
          background: 'var(--pw-bg)',
          borderRadius: '6px',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid var(--pw-border)',
        }}
      >
        {icon}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div
          style={{
            color: 'var(--pw-text-tertiary)',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '2px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: 'var(--pw-text)',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function FacilityTag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderRadius: 'var(--pw-radius-full)',
        fontSize: '12px',
        fontWeight: 500,
        background: 'var(--pw-surface)',
        color: 'var(--pw-text-secondary)',
        border: '1px solid var(--pw-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <span style={{ color: 'var(--pw-primary)', display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}
