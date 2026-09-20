// =============================================================================
// POP — Listing & Host Repository (AWS DynamoDB + Local Fallback)
// =============================================================================
// Provides transparent dual-mode persistence for host listings, host profiles,
// and bookings:
//   1. Real AWS DynamoDB when AWS credentials/environment are configured.
//   2. In-memory local fallback during local development/offline testing.
// =============================================================================

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDocClient, TABLES, isDynamoConfigured } from './dynamoClient';
import { ParkingListing, INITIAL_LISTING_STATE } from '@/types/listingModel';
import * as inMemory from '@/services/host/inMemoryStore';

let listingIdCounter = 1;

export const listingRepository = {
  /**
   * Create a new parking listing
   */
  async createListing(userId: string, data: Record<string, unknown>): Promise<ParkingListing> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.createListing(userId, data);
    }

    const listingId = `listing_${Date.now()}_${listingIdCounter++}`;
    const listing: ParkingListing = {
      ...INITIAL_LISTING_STATE,
      ...data,
      listingId,
      hostId: userId,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ParkingListing;

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLES.listings,
          Item: listing,
        })
      );
      return listing;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB createListing error, falling back to local:', err);
      return inMemory.createListing(userId, data);
    }
  },

  /**
   * Get all listings for a host
   */
  async getHostListings(userId: string): Promise<ParkingListing[]> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getHostListings(userId);
    }

    try {
      // Try querying using ByHostIndex
      try {
        const res = await docClient.send(
          new QueryCommand({
            TableName: TABLES.listings,
            IndexName: 'ByHostIndex',
            KeyConditionExpression: 'hostId = :h',
            ExpressionAttributeValues: {
              ':h': userId,
            },
          })
        );
        if (res.Items && res.Items.length > 0) {
          return res.Items as ParkingListing[];
        }
      } catch {
        // Fall back to filtered Scan if GSI is not indexed yet
      }

      const scanRes = await docClient.send(
        new ScanCommand({
          TableName: TABLES.listings,
          FilterExpression: 'hostId = :h',
          ExpressionAttributeValues: {
            ':h': userId,
          },
        })
      );
      return (scanRes.Items || []) as ParkingListing[];
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getHostListings error, using local fallback:', err);
      return inMemory.getHostListings(userId);
    }
  },

  /**
   * Get a single listing by ID, scoped to user
   */
  async getListing(listingId: string, userId: string): Promise<ParkingListing | null> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getListing(listingId, userId);
    }

    try {
      const res = await docClient.send(
        new GetCommand({
          TableName: TABLES.listings,
          Key: { listingId },
        })
      );
      const item = res.Item as ParkingListing | undefined;
      if (!item || item.hostId !== userId) return null;
      return item;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getListing error, using local fallback:', err);
      return inMemory.getListing(listingId, userId);
    }
  },

  /**
   * Update an existing listing
   */
  async updateListing(
    listingId: string,
    userId: string,
    data: Record<string, unknown>
  ): Promise<ParkingListing | null> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.updateListing(listingId, userId, data);
    }

    try {
      const existing = await this.getListing(listingId, userId);
      if (!existing) return null;

      const updated: ParkingListing = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
      } as ParkingListing;

      await docClient.send(
        new PutCommand({
          TableName: TABLES.listings,
          Item: updated,
        })
      );
      return updated;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB updateListing error, using local fallback:', err);
      return inMemory.updateListing(listingId, userId, data);
    }
  },

  /**
   * Delete a listing
   */
  async deleteListing(listingId: string, userId: string): Promise<boolean> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.deleteListing(listingId, userId);
    }

    try {
      const existing = await this.getListing(listingId, userId);
      if (!existing) return false;

      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.listings,
          Key: { listingId },
        })
      );
      return true;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB deleteListing error, using local fallback:', err);
      return inMemory.deleteListing(listingId, userId);
    }
  },

  /**
   * Resubmit listing after rejection
   */
  async resubmitListing(listingId: string, userId: string): Promise<ParkingListing | null> {
    return this.updateListing(listingId, userId, {
      status: 'pending_review',
      rejectionReason: null,
    });
  },

  /**
   * Get all pending listings for admin review
   */
  async getPendingListings(status = 'pending_review'): Promise<ParkingListing[]> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getAdminListings(status);
    }

    try {
      const res = await docClient.send(
        new ScanCommand({
          TableName: TABLES.listings,
          FilterExpression: '#st = :s',
          ExpressionAttributeNames: {
            '#st': 'status',
          },
          ExpressionAttributeValues: {
            ':s': status,
          },
        })
      );
      return (res.Items || []) as ParkingListing[];
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getPendingListings error, using local fallback:', err);
      return inMemory.getAdminListings(status);
    }
  },

  /**
   * Approve listing (Admin action)
   */
  async approveListing(listingId: string): Promise<ParkingListing | null> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.approveListing(listingId);
    }

    try {
      const scanRes = await docClient.send(
        new GetCommand({
          TableName: TABLES.listings,
          Key: { listingId },
        })
      );
      const item = scanRes.Item as ParkingListing | undefined;
      if (!item) return inMemory.approveListing(listingId);

      item.status = 'approved';
      item.reviewedAt = new Date().toISOString();
      item.rejectionReason = null;
      item.updatedAt = new Date().toISOString();

      await docClient.send(
        new PutCommand({
          TableName: TABLES.listings,
          Item: item,
        })
      );
      return item;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB approveListing error, using fallback:', err);
      return inMemory.approveListing(listingId);
    }
  },

  /**
   * Reject listing (Admin action)
   */
  async rejectListing(listingId: string, reason: string): Promise<ParkingListing | null> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.rejectListing(listingId, reason);
    }

    try {
      const scanRes = await docClient.send(
        new GetCommand({
          TableName: TABLES.listings,
          Key: { listingId },
        })
      );
      const item = scanRes.Item as ParkingListing | undefined;
      if (!item) return inMemory.rejectListing(listingId, reason);

      item.status = 'rejected';
      item.rejectionReason = reason;
      item.updatedAt = new Date().toISOString();

      await docClient.send(
        new PutCommand({
          TableName: TABLES.listings,
          Item: item,
        })
      );
      return item;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB rejectListing error, using fallback:', err);
      return inMemory.rejectListing(listingId, reason);
    }
  },

  /**
   * Get host profile
   */
  async getHostProfile(userId: string): Promise<Record<string, unknown>> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getHostProfile(userId);
    }

    try {
      const res = await docClient.send(
        new GetCommand({
          TableName: TABLES.hosts,
          Key: { userId },
        })
      );
      return (
        res.Item || {
          userId,
          verification: { status: 'not_submitted' },
          createdAt: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getHostProfile error, using local fallback:', err);
      return inMemory.getHostProfile(userId);
    }
  },

  /**
   * Update host profile
   */
  async updateHostProfile(userId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.updateHostProfile(userId, data);
    }

    try {
      const existing = await this.getHostProfile(userId);
      const updated = {
        ...existing,
        ...data,
        userId,
        updatedAt: new Date().toISOString(),
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLES.hosts,
          Item: updated,
        })
      );
      return updated;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB updateHostProfile error, using local fallback:', err);
      return inMemory.updateHostProfile(userId, data);
    }
  },
  /**
   * Public discovery of available rent listings for drivers
   */
  async getPublicRentListings(filters?: {
    query?: string;
    vehicleType?: string;
    parkingType?: string;
    maxHourly?: number;
  }): Promise<ParkingListing[]> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getPublicRentListings(filters);
    }

    try {
      // Query approved listings from DynamoDB
      const res = await docClient.send(
        new ScanCommand({
          TableName: TABLES.listings,
          FilterExpression: '#st = :s',
          ExpressionAttributeNames: {
            '#st': 'status',
          },
          ExpressionAttributeValues: {
            ':s': 'approved',
          },
        })
      );

      let items = (res.Items || []) as ParkingListing[];

      // If DynamoDB is newly created and has 0 approved listings, combine with initial seed listings
      if (items.length === 0) {
        items = inMemory.getPublicRentListings(filters);
        return items;
      }

      if (filters?.query) {
        const q = filters.query.toLowerCase().trim();
        items = items.filter(
          (l) =>
            l.location?.locality?.toLowerCase().includes(q) ||
            l.location?.address?.toLowerCase().includes(q) ||
            l.location?.city?.toLowerCase().includes(q) ||
            l.parkingDetails?.features?.some((f) => f.toLowerCase().includes(q))
        );
      }

      if (filters?.vehicleType && filters.vehicleType !== 'all') {
        items = items.filter(
          (l) =>
            l.parkingDetails?.vehicleType?.toLowerCase() === filters.vehicleType?.toLowerCase() ||
            l.parkingDetails?.vehicleType?.toLowerCase() === 'both'
        );
      }

      if (filters?.parkingType && filters.parkingType !== 'all') {
        items = items.filter(
          (l) => l.parkingDetails?.parkingType?.toLowerCase() === filters.parkingType?.toLowerCase()
        );
      }

      if (filters?.maxHourly && !isNaN(filters.maxHourly)) {
        items = items.filter((l) => {
          const rate = parseFloat(l.pricing?.hourly || '0');
          return rate <= filters.maxHourly!;
        });
      }

      return items;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getPublicRentListings error, using local fallback:', err);
      return inMemory.getPublicRentListings(filters);
    }
  },

  /**
   * Create a booking reservation
   */
  async createBooking(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.createBooking(data);
    }

    const bookingId = `booking_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const booking = {
      ...data,
      bookingId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLES.bookings,
          Item: booking,
        })
      );
      return booking;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB createBooking error, using local fallback:', err);
      return inMemory.createBooking(data);
    }
  },

  /**
   * Get all bookings for a renter
   */
  async getUserBookings(userId: string): Promise<Record<string, unknown>[]> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.getUserBookings(userId);
    }

    try {
      // Query with ByUserIndex or Scan
      try {
        const queryRes = await docClient.send(
          new QueryCommand({
            TableName: TABLES.bookings,
            IndexName: 'ByUserIndex',
            KeyConditionExpression: 'userId = :u',
            ExpressionAttributeValues: {
              ':u': userId,
            },
          })
        );
        if (queryRes.Items && queryRes.Items.length > 0) {
          return queryRes.Items as Record<string, unknown>[];
        }
      } catch {
        // Fall back to scan
      }

      const scanRes = await docClient.send(
        new ScanCommand({
          TableName: TABLES.bookings,
          FilterExpression: 'renterId = :r OR userId = :r',
          ExpressionAttributeValues: {
            ':r': userId,
          },
        })
      );
      return (scanRes.Items || []) as Record<string, unknown>[];
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB getUserBookings error, using local fallback:', err);
      return inMemory.getUserBookings(userId);
    }
  },

  /**
   * Cancel booking for user
   */
  async cancelUserBooking(bookingId: string, userId: string): Promise<Record<string, unknown> | null> {
    const docClient = getDynamoDocClient();
    if (!docClient || !isDynamoConfigured()) {
      return inMemory.cancelBooking(bookingId, userId);
    }

    try {
      const getRes = await docClient.send(
        new GetCommand({
          TableName: TABLES.bookings,
          Key: { bookingId },
        })
      );
      const booking = getRes.Item as Record<string, unknown> | undefined;
      if (!booking) return inMemory.cancelBooking(bookingId, userId);

      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      await docClient.send(
        new PutCommand({
          TableName: TABLES.bookings,
          Item: booking,
        })
      );
      return booking;
    } catch (err) {
      console.warn('[ListingRepository] DynamoDB cancelUserBooking error, using fallback:', err);
      return inMemory.cancelBooking(bookingId, userId);
    }
  },
};
