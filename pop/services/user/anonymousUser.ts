// =============================================================================
// ParkWise — Anonymous User Identity & Cooldown Service
// =============================================================================
// Manages privacy-preserving anonymous client IDs and prompt cooldowns.
// No PII (phone, email, name) is ever tracked or required.
// =============================================================================

const STORAGE_KEY_USER_ID = 'parkwise_anon_user_id';
const STORAGE_KEY_DISMISSED_PROMPTS = 'parkwise_dismissed_prompts';

/**
 * Get or generate a persistent anonymous user identifier.
 * Safe for browser execution only.
 */
export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') {
    return 'anon_server_user';
  }

  try {
    let id = localStorage.getItem(STORAGE_KEY_USER_ID);
    if (!id) {
      id = `anon_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_KEY_USER_ID, id);
    }
    return id;
  } catch {
    return `anon_temp_${Date.now().toString(36)}`;
  }
}

/**
 * Check if a proximity prompt for a parking spot was dismissed recently (1 hour cooldown).
 */
export function isPromptCooldownActive(parkingId: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_PROMPTS);
    if (!raw) return false;

    const map: Record<string, number> = JSON.parse(raw);
    const dismissedAt = map[parkingId];
    if (!dismissedAt) return false;

    // 1-hour cooldown (3600000 ms)
    const ONE_HOUR = 60 * 60 * 1000;
    return Date.now() - dismissedAt < ONE_HOUR;
  } catch {
    return false;
  }
}

/**
 * Mark a proximity prompt as dismissed for a parking spot.
 */
export function setPromptDismissed(parkingId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_PROMPTS);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[parkingId] = Date.now();
    localStorage.setItem(STORAGE_KEY_DISMISSED_PROMPTS, JSON.stringify(map));
  } catch {
    // Ignore localStorage errors
  }
}
