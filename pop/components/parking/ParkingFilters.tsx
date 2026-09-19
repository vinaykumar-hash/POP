'use client';

import { useState } from 'react';
import type { ParkingType, VehicleType } from '@/types/parking';
import {
  IconSparkles,
  IconCurrencyRupee,
  IconCovered,
  IconParking,
  IconArea,
  IconCar,
  IconTwoWheeler,
  IconEvCharging,
} from '@/components/common/Icons';

interface ParkingFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
}

export interface FilterState {
  types: ParkingType[];
  vehicleType?: VehicleType;
  covered?: boolean;
  evCharging?: boolean;
}

interface FilterChipDef {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const TYPE_CHIPS: FilterChipDef[] = [
  { key: 'FREE', label: 'Free', icon: <IconSparkles size={12} /> },
  { key: 'PAID', label: 'Paid', icon: <IconCurrencyRupee size={12} /> },
  { key: 'GARAGE', label: 'Garage', icon: <IconCovered size={12} /> },
  { key: 'PUBLIC', label: 'Public', icon: <IconParking size={12} /> },
  { key: 'OPEN', label: 'Open Plot', icon: <IconArea size={12} /> },
];

const VEHICLE_CHIPS: FilterChipDef[] = [
  { key: 'CAR', label: 'Car', icon: <IconCar size={13} /> },
  { key: 'TWO_WHEELER', label: 'Two-Wheeler', icon: <IconTwoWheeler size={13} /> },
];

const FACILITY_CHIPS: FilterChipDef[] = [
  { key: 'covered', label: 'Covered', icon: <IconCovered size={12} /> },
  { key: 'evCharging', label: 'EV Charging', icon: <IconEvCharging size={12} /> },
];

export default function ParkingFilters({ onFiltersChange }: ParkingFiltersProps) {
  const [activeTypes, setActiveTypes] = useState<ParkingType[]>([]);
  const [activeVehicle, setActiveVehicle] = useState<VehicleType | undefined>();
  const [covered, setCovered] = useState<boolean | undefined>();
  const [evCharging, setEvCharging] = useState<boolean | undefined>();

  const hasActiveFilters =
    activeTypes.length > 0 || activeVehicle !== undefined || covered || evCharging;

  const resetAll = () => {
    setActiveTypes([]);
    setActiveVehicle(undefined);
    setCovered(undefined);
    setEvCharging(undefined);
    onFiltersChange({ types: [], vehicleType: undefined, covered: undefined, evCharging: undefined });
  };

  const toggleType = (type: ParkingType) => {
    const next = activeTypes.includes(type)
      ? activeTypes.filter((t) => t !== type)
      : [...activeTypes, type];
    setActiveTypes(next);
    onFiltersChange({ types: next, vehicleType: activeVehicle, covered, evCharging });
  };

  const toggleVehicle = (type: VehicleType) => {
    const next = activeVehicle === type ? undefined : type;
    setActiveVehicle(next);
    onFiltersChange({ types: activeTypes, vehicleType: next, covered, evCharging });
  };

  const toggleFacility = (key: string) => {
    if (key === 'covered') {
      const next = covered === true ? undefined : true;
      setCovered(next);
      onFiltersChange({ types: activeTypes, vehicleType: activeVehicle, covered: next, evCharging });
    } else if (key === 'evCharging') {
      const next = evCharging === true ? undefined : true;
      setEvCharging(next);
      onFiltersChange({ types: activeTypes, vehicleType: activeVehicle, covered, evCharging: next });
    }
  };

  return (
    <div
      className="hide-scrollbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        padding: '6px 16px',
      }}
    >
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetAll}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          ✕ Reset
        </button>
      )}

      {TYPE_CHIPS.map((chip) => {
        const isActive = activeTypes.includes(chip.key as ParkingType);
        return (
          <button
            key={chip.key}
            type="button"
            className={`filter-chip ${isActive ? 'active' : ''}`}
            onClick={() => toggleType(chip.key as ParkingType)}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        );
      })}

      <span style={{ width: '1px', height: '18px', background: 'var(--pw-border)', margin: '0 4px', flexShrink: 0 }} />

      {VEHICLE_CHIPS.map((chip) => {
        const isActive = activeVehicle === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            className={`filter-chip ${isActive ? 'active' : ''}`}
            onClick={() => toggleVehicle(chip.key as VehicleType)}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        );
      })}

      <span style={{ width: '1px', height: '18px', background: 'var(--pw-border)', margin: '0 4px', flexShrink: 0 }} />

      {FACILITY_CHIPS.map((chip) => {
        const isActive =
          (chip.key === 'covered' && covered) || (chip.key === 'evCharging' && evCharging);
        return (
          <button
            key={chip.key}
            type="button"
            className={`filter-chip ${isActive ? 'active' : ''}`}
            onClick={() => toggleFacility(chip.key)}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
