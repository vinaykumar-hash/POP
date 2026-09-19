// =============================================================================
// ParkWise — Smart Spot Alerts Service
// =============================================================================

import { publishParkingEvent } from '@/services/events/eventBridgeClient';

export interface SpotSubscription {
  id: string;
  parkingId: string;
  parkingName: string;
  userId: string;
  subscribedAt: string;
  status: 'ACTIVE' | 'TRIGGERED' | 'EXPIRED';
}

// In-memory subscription registry (backed by DynamoDB ParkWise-Alerts in cloud)
const subscriptions: Map<string, SpotSubscription> = new Map();

// Local active alert notifications queue for client retrieval
const pendingAlertNotifications: Array<{
  id: string;
  parkingId: string;
  parkingName: string;
  userId: string;
  message: string;
  timestamp: string;
}> = [];

/**
 * Subscribes a driver to receive an alert when a parking space becomes available.
 */
export function subscribeToSpot(
  parkingId: string,
  userId: string,
  parkingName: string
): SpotSubscription {
  const id = `alert_${parkingId}_${userId}`;
  const sub: SpotSubscription = {
    id,
    parkingId,
    parkingName,
    userId,
    subscribedAt: new Date().toISOString(),
    status: 'ACTIVE',
  };

  subscriptions.set(id, sub);
  return sub;
}

/**
 * Checks if a parking spot has active subscribers and triggers alerts
 * if the status transitioned to AVAILABLE.
 */
export async function checkAndTriggerAlerts(
  parkingId: string,
  newStatus: string,
  parkingName: string = 'Bengaluru Parking'
): Promise<number> {
  if (newStatus !== 'AVAILABLE') return 0;

  let triggeredCount = 0;
  const now = new Date().toISOString();

  for (const [id, sub] of subscriptions.entries()) {
    if (sub.parkingId === parkingId && sub.status === 'ACTIVE') {
      sub.status = 'TRIGGERED';
      triggeredCount++;

      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        parkingId,
        parkingName: sub.parkingName || parkingName,
        userId: sub.userId,
        message: `A parking spot just opened up at ${sub.parkingName || 'your watched location'}!`,
        timestamp: now,
      };

      pendingAlertNotifications.push(notification);

      // Publish event to EventBridge / Local Bus
      await publishParkingEvent('SpotAlertTriggered', {
        parkingId,
        eventType: 'SPOT_ALERT_TRIGGERED',
        timestamp: now,
        source: 'ALERT_ENGINE',
        userId: sub.userId,
        parkingName: sub.parkingName,
      });
    }
  }

  return triggeredCount;
}

/**
 * Retrieve and clear pending alert notifications for a user
 */
export function getPendingAlertsForUser(userId: string) {
  const alerts = pendingAlertNotifications.filter((n) => n.userId === userId);
  // Keep notifications for 1 minute
  return alerts;
}

/**
 * Check if a driver is currently subscribed to a parking spot
 */
export function isUserSubscribed(parkingId: string, userId: string): boolean {
  const id = `alert_${parkingId}_${userId}`;
  const sub = subscriptions.get(id);
  return sub?.status === 'ACTIVE';
}
