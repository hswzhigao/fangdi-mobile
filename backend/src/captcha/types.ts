/**
 * Shared CAPTCHA domain types.
 *
 * CaptchaPurpose drives purpose-specific routing, fallback URLs,
 * and validation. Only 'new-house' | 'old-house' are valid.
 */
export type CaptchaPurpose = 'new-house' | 'old-house';

export const VALID_PURPOSES: readonly CaptchaPurpose[] = ['new-house', 'old-house'];

/** Lightweight session data returned to the browser. */
export interface CaptchaData {
  sessionId: string;
  image: string; // data:image/...;base64,...
  expiresAt: string;
}

/** D1 row shape (the hash is the PK, never returned to clients). */
export interface CaptchaSessionRecord {
  session_hash: string;
  purpose: string;
  upstream_ref: string | null;
  attempts: number;
  created_at: string;
  expires_at: string;
}

/** Returned from CaptchaStore.create. */
export interface CreateSessionResult {
  sessionId: string;
  expiresAt: string;
}

/** Returned from CaptchaStore.get. */
export interface CaptchaSessionState {
  purpose: CaptchaPurpose;
  attempts: number;
  expiresAt: string;
}
