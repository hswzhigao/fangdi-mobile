-- Bootstrap migration with captcha_sessions for hashed, short-lived manual CAPTCHA state.
-- worker-002 added HTTP contracts; db-003 adds the session D1 schema.
CREATE TABLE IF NOT EXISTS captcha_sessions (
  session_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  upstream_ref TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_sessions_expiry
  ON captcha_sessions (expires_at);
