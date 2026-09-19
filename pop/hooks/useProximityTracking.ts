'use client';

// =============================================================================
// ParkWise — Proximity Tracking Hook
// =============================================================================
// Tracks user GPS position at 30-second intervals when near parking spots.
// Communicates with /api/proximity/track to detect dwell time and parking probability.
// Triggers confirmation modal and notifications when user is detected staying near a spot.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface NearbySpotInfo {
  id: string;
  name: string;
  distanceMeters: number;
  dwellSeconds: number;
  probability: number;
}

export interface ParkingPromptData {
  parkingId: string;
  parkingName: string;
  probability: number;
}

interface UseProximityTrackingOptions {
  userLocation: { lat: number; lng: number } | null;
  enabled?: boolean;
  isNearSpot?: boolean;
  onAvailabilityUpdated?: () => void;
}

export function useProximityTracking({
  userLocation,
  enabled = true,
  isNearSpot,
  onAvailabilityUpdated,
}: UseProximityTrackingOptions) {
  const { user } = useAuth();
  const [nearbySpot, setNearbySpot] = useState<NearbySpotInfo | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<ParkingPromptData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);

  // Persistent anonymous or authenticated user ID
  const userIdRef = useRef<string>('');
  useEffect(() => {
    if (user?.id) {
      userIdRef.current = user.id;
    } else {
      let stored = '';
      if (typeof window !== 'undefined') {
        stored = localStorage.getItem('parkwise_client_user_id') || '';
        if (!stored) {
          stored = 'usr_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('parkwise_client_user_id', stored);
        }
      }
      userIdRef.current = stored || 'usr_anon_tracker';
    }
  }, [user]);

  // Request browser notification permission gently once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // We do not force prompt, but request if user interacts
      }
    }
  }, []);

  // Stable refs for values that change on re-renders but shouldn't re-trigger intervals
  const locationRef = useRef(userLocation);
  locationRef.current = userLocation;

  const onAvailabilityUpdatedRef = useRef(onAvailabilityUpdated);
  onAvailabilityUpdatedRef.current = onAvailabilityUpdated;

  const isPingingRef = useRef(false);
  const lastPingTimestampRef = useRef<number>(0);

  // Send GPS proximity ping to backend
  const sendPing = useCallback(async (force = false) => {
    const loc = locationRef.current;
    if (!loc || !enabled) return;

    const now = Date.now();
    // Enforce 30s throttling (minimum 25s between automatic pings)
    if (!force && now - lastPingTimestampRef.current < 25000) {
      return;
    }

    if (isPingingRef.current) return;
    isPingingRef.current = true;

    try {
      setIsTracking(true);
      const res = await fetch('/api/proximity/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userIdRef.current,
          lat: loc.lat,
          lng: loc.lng,
          timestamp: now,
        }),
      });

      lastPingTimestampRef.current = now;
      setLastPingTime(new Date(now));

      if (!res.ok) return;

      const data = await res.json();

      if (data.isNearParking && data.parkingId) {
        setNearbySpot({
          id: data.parkingId,
          name: data.parkingName || 'Parking Spot',
          distanceMeters: data.distanceMeters || 0,
          dwellSeconds: data.dwellSeconds || 0,
          probability: data.probability || 0,
        });

        // Backend signaled that user has stayed near this parking spot (dwell >= 60s)
        if (data.shouldPrompt) {
          setPendingPrompt({
            parkingId: data.parkingId,
            parkingName: data.parkingName,
            probability: data.probability,
          });

          // Show native Web notification if permitted
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('POP — Did you park?', {
              body: `We noticed you stopped near ${data.parkingName}. Did you park here?`,
              icon: '/icons/icon-192x192.png',
            });
          }

          // Callback to refresh data in map or cards
          onAvailabilityUpdatedRef.current?.();
        }
      } else {
        setNearbySpot(null);
      }
    } catch (err: any) {
      // Ignore network aborts or silent connection resets
      if (err?.name !== 'AbortError') {
        console.warn('[useProximityTracking] Proximity ping deferred:', err?.message || err);
      }
    } finally {
      isPingingRef.current = false;
      setIsTracking(false);
    }
  }, [enabled]);

  const hasLocation = !!(userLocation?.lat && userLocation?.lng);

  // Send ping every 30 seconds ONLY when near a known parking spot
  useEffect(() => {
    // If isNearSpot is specified, only track when approaching/near a spot
    const shouldTrack = enabled && hasLocation && (isNearSpot !== false);
    if (!shouldTrack) {
      setNearbySpot(null);
      return;
    }

    // Alert server immediately when arriving near a parking spot
    sendPing(true);

    const interval = setInterval(() => {
      sendPing(true);
    }, 30000); // 30-second GPS dwell checking interval

    return () => clearInterval(interval);
  }, [enabled, hasLocation, isNearSpot, sendPing]);

  // Respond to the "Did you park here?" prompt
  const respondToPrompt = useCallback(
    async (didPark: boolean) => {
      if (!pendingPrompt) return;

      const { parkingId } = pendingPrompt;
      setPendingPrompt(null);

      try {
        await fetch('/api/proximity/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            parkingId,
            didPark,
          }),
        });

        onAvailabilityUpdated?.();
      } catch (error) {
        console.error('[useProximityTracking] Failed to submit parking confirmation:', error);
      }
    },
    [pendingPrompt, onAvailabilityUpdated]
  );

  const dismissPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  return {
    isTracking,
    nearbySpot,
    pendingPrompt,
    lastPingTime,
    respondToPrompt,
    dismissPrompt,
    triggerManualPing: sendPing,
  };
}
