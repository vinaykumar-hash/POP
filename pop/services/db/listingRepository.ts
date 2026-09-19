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
};
