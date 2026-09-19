'use client';

// =============================================================================
// POP — AI Parking Assistant Modal (Amazon Bedrock)
// =============================================================================

import React, { useState } from 'react';
import type { ParkingLocation } from '@/types/parking';
import {
  IconClose,
  IconSparkles,
  IconPin,
  IconCar,
  IconCapacity,
  IconTrending,
  IconClock,
  IconRadar,
} from '@/components/common/Icons';

interface AiRecommendation {
  parking: ParkingLocation;
  distanceMeters: number;
  roadDistanceMeters?: number;
  estimatedDriveTimeSeconds?: number;
  matchScore: number;
  predictedOccupancy: number;
  predictionSummary: string;
}

interface AiResponse {
  intent: {
    destination: string;
    type?: string;
    vehicleType?: string;
    covered?: boolean;
    evCharging?: boolean;
    arrivalTime?: string;
    reasoning: string;
    provider: string;
  };
  recommendations: AiRecommendation[];
  assistantMessage: string;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectParking: (parking: ParkingLocation) => void;
  userLat?: number;
  userLng?: number;
  userLocation?: { lat: number; lng: number } | null;
}

const PRESET_PROMPTS = [
  'Free 4-wheeler parking near Indiranagar around 8 PM',
  'Covered EV charging garage near MG Road',
  'Low price parking near Koramangala 5th Block',
  'Two wheeler spot near Whitefield tech park',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectParking,
  userLat,
  userLng,
  userLocation,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveLocation =
    userLocation ||
    (userLat !== undefined && userLng !== undefined
      ? { lat: userLat, lng: userLng }
      : null);

  if (!isOpen) return null;

  const handleQuery = async (queryText: string) => {
    setIsLoading(true);
    setError(null);
    setPrompt(queryText);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          userLocation: effectiveLocation,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch AI recommendations');
      }

      const data: AiResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error executing AI discovery query');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (parking: ParkingLocation) => {
    onSelectParking(parking);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Ambient Glows */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <IconClose size={16} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-semibold mb-2">
            <IconSparkles size={13} style={{ color: '#0284c7' }} />
            <span>Amazon Bedrock AI Discovery</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Ask POP AI Assistant
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Describe what you need in plain English — locality, vehicle type, budget, or arrival time.
          </p>
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) handleQuery(prompt);
          }}
          className="mb-4"
        >
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Free 4-wheeler covered parking near MG Road around 8 PM"
              className="w-full pl-4 pr-24 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-colors shadow-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
              id="ai-assistant-submit-btn"
            >
              {isLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>Ask AI</>
              )}
            </button>
          </div>
        </form>

        {/* Preset Chips */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Try an Example Query
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_PROMPTS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuery(preset)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-cyan-400 text-xs text-slate-700 hover:text-cyan-800 transition-all text-left"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
            {error}
          </div>
        )}

        {/* Results Container (Scrollable) */}
        {result && (
          <div className="space-y-4 animate-in fade-in duration-300 border-t border-slate-200 pt-4 overflow-y-auto pr-1">
            {/* Extracted Intent Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-slate-500 mr-1">Extracted Intent:</span>
              <span className="px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-medium inline-flex items-center gap-1.5">
                <IconPin size={12} />
                <span>{result.intent.destination}</span>
              </span>
              {result.intent.vehicleType && (
                <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium inline-flex items-center gap-1.5">
                  <IconCar size={12} />
                  <span>{result.intent.vehicleType}</span>
                </span>
              )}
              {result.intent.type && result.intent.type !== 'ALL' && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  {result.intent.type}
                </span>
              )}
              {result.intent.arrivalTime && (
                <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-xs font-medium inline-flex items-center gap-1.5">
                  <IconClock size={12} />
                  <span>{result.intent.arrivalTime}</span>
                </span>
              )}
            </div>

            {/* AI Advisory Reasoning */}
            <div className="p-3.5 bg-cyan-50 border border-cyan-200 rounded-xl">
              <div className="text-xs font-bold text-cyan-800 mb-1 flex items-center gap-1.5">
                <IconRadar size={14} />
                <span>POP AI Advisory</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed m-0">
                {result.assistantMessage}
              </p>
            </div>

            {/* Recommendations List */}
            <div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Top Recommendations ({result.recommendations.length})
              </div>

              {result.recommendations.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  No direct parking matches found matching all criteria within 4km of {result.intent.destination}.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {result.recommendations.map((rec) => (
                    <div
                      key={rec.parking.id}
                      className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-cyan-400 transition-all flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {rec.parking.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-bold border border-cyan-300">
                            {rec.matchScore}% Match
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <IconPin size={12} />
                            <span>{Math.round(rec.distanceMeters)}m away</span>
                          </span>
                          {rec.estimatedDriveTimeSeconds && (
                            <span className="inline-flex items-center gap-1">
                              <IconCar size={12} />
                              <span>~{Math.round(rec.estimatedDriveTimeSeconds / 60)} min drive</span>
                            </span>
                          )}
                          {rec.parking.capacity && (
                            <span className="inline-flex items-center gap-1">
                              <IconCapacity size={12} />
                              <span>{rec.parking.capacity} spaces</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium mt-1 inline-flex items-center gap-1">
                          <IconTrending size={12} />
                          <span>{rec.predictionSummary}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelect(rec.parking)}
                        className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm active:scale-95"
                        id={`ai-select-spot-${rec.parking.id}`}
                      >
                        <IconPin size={13} />
                        <span>View on Map</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
