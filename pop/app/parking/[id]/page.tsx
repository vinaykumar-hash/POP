import { getParkingLocationById } from '@/services/parking/parkingDataService';
import type { Metadata } from 'next';
import Link from 'next/link';
import OccupancyChart from '@/components/parking/OccupancyChart';
import CrowdsourceReporter from '@/components/parking/CrowdsourceReporter';
import { SpotAlertButton } from '@/components/parking/SpotAlertButton';
import {
  IconPin,
  IconNavigation,
  IconParking,
  IconCar,
  IconTwoWheeler,
  IconBicycle,
  IconCovered,
  IconCctv,
  IconLighting,
  IconEvCharging,
  IconSecurity,
  IconAccessibility,
  IconRestroom,
  IconCheck,
} from '@/components/common/Icons';

export async function generateMetadata(
  props: PageProps<'/parking/[id]'>
): Promise<Metadata> {
  const { id } = await props.params;
  const parking = await getParkingLocationById(id);

  return {
    title: parking
      ? `${parking.name} — Bengaluru Parking | POP`
      : 'Parking Not Found — POP',
    description: parking
      ? `${parking.name} — ${parking.type} parking in Bengaluru. Real-time availability, crowdsourced reports, pricing, and directions.`
      : 'Parking location not found.',
  };
}

export default async function ParkingDetailPage(
  props: PageProps<'/parking/[id]'>
) {
  const { id } = await props.params;
  const parking = await getParkingLocationById(id);

  if (!parking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--pw-bg)',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--pw-primary-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-primary)',
          }}
        >
          <IconParking size={32} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--pw-text)',
          }}
        >
          Parking Location Not Found
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--pw-text-secondary)',
          }}
        >
          We couldn&apos;t find parking location &quot;{id}&quot;. It may have been removed or updated.
        </p>
        <Link href="/" className="pw-btn pw-btn-primary" style={{ textDecoration: 'none' }}>
          Back to Map Discovery
        </Link>
      </div>
    );
  }

  const facilities = parking.facilities;
  const rawMeta = (parking.sourceMetadata || {}) as Record<string, any>;
  const rawArea =
    parking.areaSquareMeters ??
    rawMeta.areaSquareMeters ??
    rawMeta.estimatedAreaM2;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pw-bg)',
        color: 'var(--pw-text)',
        paddingBottom: '60px',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          height: 'var(--navbar-height, 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid var(--pw-border)',
          background: 'var(--pw-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/"
            className="pw-btn pw-btn-secondary pw-btn-sm"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            ← Map
          </Link>
          <div style={{ fontSize: '13px', color: 'var(--pw-text-tertiary)' }}>
            Bengaluru / {parking.name}
          </div>
        </div>
        <Link
          href="/"
          style={{
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--pw-text)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
          }}
        >
          <span>POP</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--pw-text-secondary)' }}>
            Parking on phone
          </span>
        </Link>
      </header>

      {/* Main Container */}
      <main
        style={{
          maxWidth: '840px',
          margin: '0 auto',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Hero Section */}
        <section
          style={{
            background: 'var(--pw-surface)',
            border: '1px solid var(--pw-border)',
            borderRadius: 'var(--pw-radius-lg, 14px)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`type-badge type-${parking.type.toLowerCase()}`}>
              {parking.type} PARKING
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--pw-text-secondary)',
                padding: '3px 10px',
                background: 'var(--pw-bg)',
                borderRadius: '9999px',
                border: '1px solid var(--pw-border)',
              }}
            >
              Source: {parking.source === 'OPENCITY' ? 'OpenCity Bengaluru' : parking.source}
            </span>
            {parking.pricePerHour !== undefined && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#059669',
                  padding: '3px 10px',
                  background: '#ecfdf5',
                  borderRadius: '9999px',
                  border: '1px solid #a7f3d0',
                }}
              >
                ₹{parking.pricePerHour}/hr
              </span>
            )}
          </div>

          <div>
            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '28px',
                fontWeight: 800,
                color: 'var(--pw-text)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              {parking.name}
            </h1>
            {parking.address && (
              <div style={{ fontSize: '14px', color: 'var(--pw-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconPin size={15} style={{ color: 'var(--pw-primary)', flexShrink: 0 }} />
                <span>{parking.address}</span>
              </div>
            )}
          </div>

          {/* Direct Navigation Action */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="pw-btn pw-btn-accent"
              style={{ textDecoration: 'none', padding: '12px 24px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              id="google-maps-btn"
            >
              <IconNavigation size={16} />
              <span>Open Google Maps Navigation</span>
            </a>
            <Link
              href="/"
              className="pw-btn pw-btn-secondary"
              style={{ textDecoration: 'none', padding: '12px 20px', fontSize: '15px' }}
            >
              Back to Discovery Map
            </Link>
          </div>
        </section>

        {/* Live Community Reporting & Smart Spot Alerts */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="pw-section-header">
            COMMUNITY DRIVER REPORTING
          </div>
          <CrowdsourceReporter
            parkingId={parking.id}
            parkingName={parking.name}
            compact={false}
          />
          <div style={{ maxWidth: '400px', marginTop: '4px' }}>
            <SpotAlertButton
              parkingId={parking.id}
              parkingName={parking.name}
              status={parking.currentAvailability?.status}
            />
          </div>
        </section>

        {/* Historical 24-Hour Occupancy Insights */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="pw-section-header">
            HISTORICAL OCCUPANCY & DWELL PATTERNS
          </div>
          <OccupancyChart parking={parking} compact={false} />
        </section>

        {/* Location Specifications */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="pw-section-header">
            LOCATION SPECIFICATIONS
          </div>
          <div
            style={{
              background: 'var(--pw-surface)',
              border: '1px solid var(--pw-border)',
              borderRadius: 'var(--pw-radius-lg, 14px)',
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            {rawArea && rawArea > 0 ? (
              <SpecItem
                label="Surveyed Area"
                value={`~${Math.round(rawArea).toLocaleString()} m²`}
                subtitle="Official GIS surveyed area"
              />
            ) : parking.capacity !== undefined ? (
              <SpecItem
                label="Capacity"
                value={`${parking.capacity} spaces`}
                subtitle="Designated vehicle bays"
              />
            ) : null}
            <SpecItem
              label="Parking Type"
              value={parking.type}
              subtitle="Open metropolitan space"
            />
            <SpecItem
              label="Operating Hours"
              value={
                parking.openingTime && parking.closingTime
                  ? `${parking.openingTime} – ${parking.closingTime}`
                  : 'Check on site'
              }
            />
            <SpecItem
              label="Coordinates (Lat, Lng)"
              value={`${parking.latitude.toFixed(5)}, ${parking.longitude.toFixed(5)}`}
              subtitle="Centroid point"
            />
            {rawMeta.areaSquareMeters && (
              <SpecItem
                label="Surveyed Land Area"
                value={`~${Math.round(rawMeta.areaSquareMeters).toLocaleString()} sq meters`}
                subtitle="Official GIS measurement"
              />
            )}
            {rawMeta.perimeterMeters && (
              <SpecItem
                label="Polygon Perimeter"
                value={`~${Math.round(rawMeta.perimeterMeters).toLocaleString()} meters`}
              />
            )}
            {rawMeta.polygonVertexCount && (
              <SpecItem
                label="Boundary Vertices"
                value={`${rawMeta.polygonVertexCount} surveyed points`}
              />
            )}
          </div>
        </section>

        {/* Facilities & Vehicle Compatibility */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="pw-section-header">
            FACILITIES & VEHICLE COMPATIBILITY
          </div>
          <div
            style={{
              background: 'var(--pw-surface)',
              border: '1px solid var(--pw-border)',
              borderRadius: 'var(--pw-radius-lg, 14px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--pw-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Vehicle Compatibility
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="type-badge" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconCar size={14} />
                  <span>Four-Wheelers (Cars)</span>
                </span>
                <span className="type-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconTwoWheeler size={14} />
                  <span>Two-Wheelers (Bikes)</span>
                </span>
                {parking.vehicleTypes?.includes('BICYCLE') && (
                  <span className="type-badge" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconBicycle size={14} />
                    <span>Bicycles</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--pw-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Facilities & Amenities
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FacilityPill active={facilities?.covered} label="Covered Canopy" icon={<IconCovered size={14} />} />
                <FacilityPill active={facilities?.cctv} label="CCTV Surveillance" icon={<IconCctv size={14} />} />
                <FacilityPill active={facilities?.lighting} label="Night Lighting" icon={<IconLighting size={14} />} />
                <FacilityPill active={facilities?.evCharging} label="EV Charging" icon={<IconEvCharging size={14} />} />
                <FacilityPill active={facilities?.security} label="Guard / Security" icon={<IconSecurity size={14} />} />
                <FacilityPill active={facilities?.wheelchairAccessible} label="Accessible Parking" icon={<IconAccessibility size={14} />} />
                <FacilityPill active={facilities?.restroom} label="Restroom Nearby" icon={<IconRestroom size={14} />} />
              </div>
            </div>
          </div>
        </section>

        {/* Data Provenance & Transparency */}
        <section
          style={{
            padding: '20px',
            background: 'var(--pw-bg)',
            border: '1px solid var(--pw-border)',
            borderRadius: 'var(--pw-radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pw-text)' }}>
            Data Transparency & Provenance
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--pw-text-secondary)', lineHeight: 1.6 }}>
            This parking spot originated from the <strong>{parking.source === 'OPENCITY' ? 'OpenCity Bengaluru Open Data' : 'Municipal Open Data'}</strong> initiative.
            Real-time availability is crowd-powered via driver dwell detection. Drivers are encouraged to confirm parking availability on-site to help calibrate the community score.
          </p>
        </section>
      </main>
    </div>
  );
}

function SpecItem({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--pw-text)', marginTop: '2px' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--pw-text-tertiary)', marginTop: '2px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function FacilityPill({ active, label, icon }: { active?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        background: active ? '#ecfdf5' : 'var(--pw-surface)',
        color: active ? '#047857' : 'var(--pw-text-tertiary)',
        border: `1px solid ${active ? '#a7f3d0' : 'var(--pw-border)'}`,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span>{label}</span>
      {active ? (
        <IconCheck size={12} style={{ color: '#059669' }} />
      ) : (
        <span style={{ fontSize: '10px', opacity: 0.5 }}>—</span>
      )}
    </span>
  );
}
