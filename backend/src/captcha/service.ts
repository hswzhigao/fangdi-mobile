/**
 * CAPTCHA service — orchestrates purpose validation, store lifecycle,
 * fixed blocked upstream result, refresh invalidation, and error mapping.
 *
 * Worker HTTP handlers should be thin; this service encapsulates all
 * captcha domain logic.
 */

import type { CaptchaPurpose, CaptchaData } from './types';
import type { CaptchaStore } from './session-store';
import { VALID_PURPOSES } from './types';

// ── Fallback URLs ─────────────────────────────────────────────────────────────

export const FALLBACK_URLS: Record<CaptchaPurpose, string> = {
  'new-house': 'https://www.fangdi.com.cn/new_house/new_house.html',
  'old-house': 'https://www.fangdi.com.cn/old_house/old_house.html',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;

// ── Error result types ────────────────────────────────────────────────────────

export type CaptchaServiceError =
  | { code: 'BAD_REQUEST'; message: string }
  | { code: 'RATE_LIMITED'; retryAfter: number }
  | { code: 'CAPTCHA_EXPIRED'; message?: string }
  | { code: 'CAPTCHA_INVALID'; message?: string }
  | { code: 'UPSTREAM_BLOCKED'; fallbackUrl: string; message?: string }
  | { code: 'INTERNAL_ERROR' };

export type CaptchaServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CaptchaServiceError };

// ── Service ───────────────────────────────────────────────────────────────────

export class CaptchaService {
  private store: CaptchaStore;

  constructor(store: CaptchaStore) {
    this.store = store;
  }

  /**
   * Validate that a purpose string is a valid CaptchaPurpose.
   * Returns the validated value or a BAD_REQUEST error.
   */
  validatePurpose(raw: string | null): { ok: true; value: CaptchaPurpose } | { ok: false; error: string } {
    if (!raw) {
      return { ok: false, error: '缺少 purpose 参数' };
    }
    const trimmed = raw.trim();
    if (!VALID_PURPOSES.includes(trimmed as CaptchaPurpose)) {
      return { ok: false, error: `purpose 值无效，允许: ${VALID_PURPOSES.join(', ')}` };
    }
    return { ok: true, value: trimmed as CaptchaPurpose };
  }

  /**
   * Create a CAPTCHA session for a given purpose.
   *
   * Currently returns UPSTREAM_BLOCKED because no upstream CAPTCHA adapter
   * is implemented. When the adapter is ready, this will fetch the image
   * from the fixed upstream endpoint, create a session on success, and
   * return the sessionId + image.
   */
  async createSession(purpose: CaptchaPurpose): Promise<CaptchaServiceResult<CaptchaData>> {
    // Upstream CAPTCHA image fetch not yet implemented.
    // When ready: fetch image → createSession in store → return CaptchaData.
    // For now: UPSTREAM_BLOCKED with purpose-specific fallback.
    return {
      ok: false,
      error: {
        code: 'UPSTREAM_BLOCKED',
        fallbackUrl: FALLBACK_URLS[purpose],
        message: '原站正在进行访问验证，移动版无法代替验证',
      },
    };
  }

  /**
   * Refresh an existing CAPTCHA session.
   *
   * 1. Validates the session ID (exists, not expired, not maxed out, purpose match).
   * 2. Deletes the old session.
   * 3. Attempts to create a new session with the same purpose.
   */
  async refreshSession(
    sessionId: string,
    expectedPurpose?: CaptchaPurpose,
  ): Promise<CaptchaServiceResult<CaptchaData>> {
    // Validate existing session
    const session = await this.store.get(sessionId);
    if (!session) {
      return { ok: false, error: { code: 'CAPTCHA_INVALID' } };
    }

    // Check expiry
    const now = new Date();
    if (new Date(session.expiresAt) <= now) {
      await this.store.remove(sessionId);
      return { ok: false, error: { code: 'CAPTCHA_EXPIRED' } };
    }

    // Check max attempts
    if (session.attempts >= MAX_ATTEMPTS) {
      await this.store.remove(sessionId);
      return { ok: false, error: { code: 'CAPTCHA_EXPIRED', message: '验证码尝试次数已达上限，请重新获取' } };
    }

    // Check purpose binding if expectedPurpose provided
    if (expectedPurpose && session.purpose !== expectedPurpose) {
      return { ok: false, error: { code: 'CAPTCHA_INVALID' } };
    }

    // Delete old session
    await this.store.remove(sessionId);

    // Create new session with same purpose
    return this.createSession(session.purpose);
  }

  /**
   * Validate and increment a session for CAPTCHA submission.
   *
   * Checks: exists → not expired → under max attempts → increment.
   * Returns the purpose on success (for downstream binding).
   * Deletes session on expired or maxed_out.
   */
  async validateAndIncrement(
    sessionId: string,
    expectedPurpose?: CaptchaPurpose,
  ): Promise<CaptchaServiceResult<{ purpose: CaptchaPurpose }>> {
    const session = await this.store.get(sessionId);
    if (!session) {
      return { ok: false, error: { code: 'CAPTCHA_INVALID' } };
    }

    const now = new Date();
    if (new Date(session.expiresAt) <= now) {
      await this.store.remove(sessionId);
      return { ok: false, error: { code: 'CAPTCHA_EXPIRED' } };
    }

    if (session.attempts >= MAX_ATTEMPTS) {
      await this.store.remove(sessionId);
      return { ok: false, error: { code: 'CAPTCHA_EXPIRED', message: '验证码尝试次数已达上限' } };
    }

    if (expectedPurpose && session.purpose !== expectedPurpose) {
      return { ok: false, error: { code: 'CAPTCHA_INVALID' } };
    }

    // Increment the attempt counter
    const newCount = await this.store.incrementAttempt(sessionId);
    if (newCount === null) {
      return { ok: false, error: { code: 'CAPTCHA_INVALID' } };
    }

    // If we just hit max, delete and report accordingly
    if (newCount >= MAX_ATTEMPTS) {
      await this.store.remove(sessionId);
      return { ok: false, error: { code: 'CAPTCHA_EXPIRED', message: '验证码尝试次数已达上限' } };
    }

    return { ok: true, data: { purpose: session.purpose } };
  }

  /**
   * Delete a session (e.g. after successful CAPTCHA validation).
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.store.remove(sessionId);
  }
}
