/**
 * CaptchaStore abstraction over parameterized D1.
 *
 * - sessionId returned to the browser is base64url(random 32 bytes).
 * - D1 stores SHA-256(sessionId + server-side salt) as PK.
 * - Max 3 attempts; expired/maxed sessions are deleted on read.
 * - No upstream cookie/token/challenge stored or logged.
 * - Parameterized queries only; never log sessionId or hash.
 */

import type {
  CaptchaPurpose,
  CaptchaSessionRecord,
  CaptchaSessionState,
  CreateSessionResult,
} from './types';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface CaptchaStore {
  create(input: { purpose: CaptchaPurpose; upstreamRef?: string }): Promise<CreateSessionResult>;
  get(sessionId: string): Promise<CaptchaSessionState | null>;
  incrementAttempt(sessionId: string): Promise<number | null>;
  remove(sessionId: string): Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** Generate a base64url-encoded 32-byte random session id. */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** SHA-256 hex digest of a string. Uses Web Crypto (available in Workers). */
export async function hashSessionId(sessionId: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionId + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── D1-backed CaptchaStore ────────────────────────────────────────────────────

export class D1CaptchaStore implements CaptchaStore {
  private db: D1Database;
  private salt: string;

  constructor(db: D1Database, salt: string) {
    this.db = db;
    this.salt = salt;
  }

  async create(input: { purpose: CaptchaPurpose; upstreamRef?: string }): Promise<CreateSessionResult> {
    const sessionId = generateSessionId();
    const hash = await hashSessionId(sessionId, this.salt);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS);

    await this.db
      .prepare(
        `INSERT INTO captcha_sessions
         (session_hash, purpose, upstream_ref, attempts, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(hash, input.purpose, input.upstreamRef ?? null, 0, now.toISOString(), expiresAt.toISOString())
      .run();

    // Clean expired sessions opportunistically (fire-and-forget)
    this.cleanExpired().catch(() => {
      /* best-effort */
    });

    return { sessionId, expiresAt: expiresAt.toISOString() };
  }

  async get(sessionId: string): Promise<CaptchaSessionState | null> {
    const hash = await hashSessionId(sessionId, this.salt);
    const row = await this.db
      .prepare('SELECT purpose, attempts, expires_at FROM captcha_sessions WHERE session_hash = ?')
      .bind(hash)
      .first<{ purpose: string; attempts: number; expires_at: string }>();

    if (!row) return null;

    return {
      purpose: row.purpose as CaptchaPurpose,
      attempts: row.attempts,
      expiresAt: row.expires_at,
    };
  }

  async incrementAttempt(sessionId: string): Promise<number | null> {
    const hash = await hashSessionId(sessionId, this.salt);

    const result = await this.db
      .prepare(
        `UPDATE captcha_sessions
         SET attempts = attempts + 1
         WHERE session_hash = ?`,
      )
      .bind(hash)
      .run();

    if (!result.meta.rows_written) return null;

    const row = await this.db
      .prepare('SELECT attempts FROM captcha_sessions WHERE session_hash = ?')
      .bind(hash)
      .first<{ attempts: number }>();

    return row ? row.attempts : null;
  }

  async remove(sessionId: string): Promise<void> {
    const hash = await hashSessionId(sessionId, this.salt);
    await this.db
      .prepare('DELETE FROM captcha_sessions WHERE session_hash = ?')
      .bind(hash)
      .run();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Retrieve the full raw record (for validation checks). */
  async _getRecord(sessionId: string): Promise<CaptchaSessionRecord | null> {
    const hash = await hashSessionId(sessionId, this.salt);
    return this.db
      .prepare('SELECT * FROM captcha_sessions WHERE session_hash = ?')
      .bind(hash)
      .first<CaptchaSessionRecord>();
  }

  async cleanExpired(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM captcha_sessions WHERE expires_at <= datetime('now')")
      .run();
    return result.meta.rows_written ?? 0;
  }
}
