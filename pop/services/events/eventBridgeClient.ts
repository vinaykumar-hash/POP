// =============================================================================
// ParkWise — AWS EventBridge Client & Local Event Bus
// =============================================================================

import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { EventEmitter } from 'events';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const EVENT_BUS_NAME = process.env.EVENTBRIDGE_BUS_NAME || 'ParkWise-EventBus-dev';

const hasEventBridge = Boolean(
  process.env.EVENTBRIDGE_BUS_NAME &&
  (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_EXECUTION_ENV)
);

let eventBridgeClient: EventBridgeClient | null = null;
if (hasEventBridge) {
  try {
    eventBridgeClient = new EventBridgeClient({ region: AWS_REGION });
  } catch (err) {
    console.warn('[ParkWise EventBridge] Client init failed, using local event bus:', err);
  }
}

// Local in-process Event Bus for local development emulation
const localBus = new EventEmitter();
localBus.setMaxListeners(50);

export type ParkingDetailType =
  | 'ParkingAvailabilityReported'
  | 'DriverParked'
  | 'DriverDeparted'
  | 'SpotAlertTriggered';

export interface ParkingEventDetail {
  parkingId: string;
  eventType: string;
  timestamp: string;
  source: string;
  anonymousUserId?: string;
  status?: string;
  confidence?: number;
  availableSpaces?: number;
  [key: string]: unknown;
}

/**
 * Publish an asynchronous event to AWS EventBridge or the local event bus
 */
export async function publishParkingEvent(
  detailType: ParkingDetailType,
  detail: ParkingEventDetail
): Promise<{ success: boolean; eventId: string; provider: 'eventbridge' | 'local-bus' }> {
  const eventId = `evt_eb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (eventBridgeClient && hasEventBridge) {
    try {
      const entry: PutEventsRequestEntry = {
        EventBusName: EVENT_BUS_NAME,
        Source: 'parkwise.parking',
        DetailType: detailType,
        Detail: JSON.stringify({ ...detail, eventId }),
        Time: new Date(),
      };

      const command = new PutEventsCommand({ Entries: [entry] });
      await eventBridgeClient.send(command);

      return {
        success: true,
        eventId,
        provider: 'eventbridge',
      };
    } catch (err) {
      console.warn('[ParkWise EventBridge] Publish failed, falling back to local bus:', err);
    }
  }

  // Local Event Bus dispatch
  localBus.emit(detailType, { ...detail, eventId });
  localBus.emit('*', { detailType, ...detail, eventId });

  return {
    success: true,
    eventId,
    provider: 'local-bus',
  };
}

/**
 * Register a listener on the local event bus (used by background workers in dev mode)
 */
export function onLocalEvent(
  detailType: ParkingDetailType | '*',
  handler: (event: ParkingEventDetail & { detailType?: string; eventId: string }) => void
): void {
  localBus.on(detailType, handler);
}

export function isEventBridgeConfigured(): boolean {
  return hasEventBridge && eventBridgeClient !== null;
}
