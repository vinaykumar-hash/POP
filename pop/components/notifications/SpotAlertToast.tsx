'use client';

// =============================================================================
// POP — Global Spot Alert Notification Toast
// =============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAnonymousUserId } from '@/services/user/anonymousUser';
import { IconSparkles, IconBell } from '@/components/common/Icons';

interface PendingAlert {
  id: string;
  parkingId: string;
  parkingName: string;
  message: string;
  timestamp: string;
}

export const SpotAlertToast: React.FC = () => {
  const [activeAlert, setActiveAlert] = useState<PendingAlert | null>(null);

  useEffect(() => {
    const userId = getAnonymousUserId();

    const checkAlerts = async () => {
      try {
        const res = await fetch(`/api/alerts/subscribe?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.pendingAlerts && data.pendingAlerts.length > 0) {
            setActiveAlert(data.pendingAlerts[0]);
          }
        }
      } catch {
        // silent
      }
    };

    // Check immediately and poll every 4 seconds
    checkAlerts();
    const interval = setInterval(checkAlerts, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!activeAlert) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-top duration-300">
      <div className="p-4 rounded-xl bg-white border border-emerald-300 shadow-2xl shadow-emerald-500/10 text-slate-900 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <IconBell size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <IconSparkles size={12} style={{ color: '#059669' }} />
              <span>SPOT JUST OPENED</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {activeAlert.parkingName}
            </div>
            <div className="text-xs text-slate-500">
              A driver just departed. Spaces are available now!
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Link
            href={`/parking/${activeAlert.parkingId}`}
            onClick={() => setActiveAlert(null)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors text-center shadow-sm"
          >
            View Spot
          </Link>
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            className="px-2 py-1 text-slate-400 hover:text-slate-700 text-[11px] rounded transition-colors text-center"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
