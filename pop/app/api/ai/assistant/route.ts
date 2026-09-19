// =============================================================================
// ParkWise — API Route: POST /api/ai/assistant (Amazon Bedrock Assistant)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { parseParkingPrompt } from '@/services/ai/bedrockClient';
import { geocodeSearch } from '@/services/geocoding/geocodingService';
import { searchNearbyParking } from '@/services/parking/parkingService';
import type { ParkingFilters, ParkingSearchResult } from '@/types/parking';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, userLat, userLng } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'A natural language "prompt" is required.' },
        { status: 400 }
      );
    }

    // 1. Natural Language Intent Extraction (Bedrock or Semantic Engine)
    const intent = await parseParkingPrompt(prompt);

    // 2. Geocode the extracted destination
    let searchLat = userLat || 12.9716;
    let searchLng = userLng || 77.5946;
    let destinationLabel = intent.destination;

    const geoResults = await geocodeSearch(intent.destination);
    if (geoResults && geoResults.length > 0) {
      searchLat = geoResults[0].latitude;
      searchLng = geoResults[0].longitude;
      destinationLabel = geoResults[0].displayName || intent.destination;
    }

    // 3. Search filtered parking candidates
    let mappedTypes: ('FREE' | 'PAID' | 'PUBLIC' | 'GARAGE' | 'OPEN')[] | undefined = undefined;
    if (intent.type === 'FREE') {
      mappedTypes = ['FREE', 'OPEN', 'PUBLIC'];
    } else if (intent.type === 'PAID') {
      mappedTypes = ['PAID', 'GARAGE', 'PUBLIC'];
    } else if (intent.type === 'PUBLIC') {
      mappedTypes = ['PUBLIC', 'OPEN', 'FREE'];
    }

    const searchFilter: ParkingFilters = {
      types: mappedTypes,
      vehicleType: intent.vehicleType && intent.vehicleType !== 'ANY' ? (intent.vehicleType as any) : undefined,
      covered: intent.covered,
      evCharging: intent.evCharging,
    };

    let candidates = await searchNearbyParking(
      searchLat,
      searchLng,
      5000,
      searchFilter
    );

    // If strictly filtered candidates is empty, relax type filters to still recommend nearby spots
    if (candidates.length === 0) {
      candidates = await searchNearbyParking(searchLat, searchLng, 5000);
    }

    // 4. Score and calibrate with real availability data
    const rankedRecommendations = candidates.slice(0, 5).map((result: ParkingSearchResult, index: number) => {
      const availability = result.parking.currentAvailability;
      const status = availability?.status ?? 'UNKNOWN';

      let matchScore = 95 - index * 6;
      if (status === 'FULL') matchScore -= 30;
      if (status === 'AVAILABLE') matchScore += 10;
      if (result.parking.capacity && result.parking.capacity > 40) matchScore += 5;

      let predictionText = status === 'AVAILABLE'
        ? 'Real-time verified: Spots currently available'
        : status === 'FULL'
        ? 'Reported full: Limited spots'
        : 'Crowd-powered data: Waiting for active user reports nearby';

      return {
        parking: result.parking,
        distanceMeters: result.straightLineDistance,
        roadDistanceMeters: result.roadDistance,
        estimatedDriveTimeSeconds: result.estimatedDriveTime,
        matchScore: Math.max(50, Math.min(99, matchScore)),
        predictedOccupancy: status === 'FULL' ? 90 : status === 'AVAILABLE' ? 20 : 50,
        predictionSummary: predictionText,
      };
    });

    // Sort by match score descending
    rankedRecommendations.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      success: true,
      prompt,
      intent,
      destination: {
        name: destinationLabel,
        latitude: searchLat,
        longitude: searchLng,
      },
      totalCandidatesFound: candidates.length,
      recommendations: rankedRecommendations,
      assistantMessage: intent.reasoning,
    });
  } catch (error: unknown) {
    console.error('[API] /api/ai/assistant error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process AI assistant query';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
