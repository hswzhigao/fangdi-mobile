#!/usr/bin/env node

/**
 * check-secrets.mjs — Scan repository for tracked secrets and credential patterns.
 *
 * Usage:
 *   node scripts/check-secrets.mjs
 *
 * Scans:
 *   - Source files (.ts, .js, .vue, .mjs, .cjs, .json, .toml, .yaml, .yml, .env)
 *   - Excludes: node_modules, dist, .git, .worktrees, build output
 *
 * Patterns checked (never printed as matched text):
 *   - Hardcoded tokens / API keys (generic high-entropy strings)
 *   - AWS / GCP / Azure credential patterns
 *   - Private keys (PEM headers)
 *   - Connection strings with passwords
 *   - Bearer tokens
 *   - JWT tokens
 *   - Generic secret= / password= patterns
 *
 * Fails with exit code 1 if any secrets are found.
 * Never prints actual secret values — only file + line + pattern description.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

// ── Configuration ──────────────────────────────────────────────────────────────

const ROOT_DIR = new URL('..', import.meta.url).pathname;

const SCAN_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.vue', '.json', '.toml', '.yaml', '.yml',
  '.env',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.worktrees', 'dist-worker', 'dist-worker-prod',
  'coverage', '__pycache__',
]);

const EXCLUDE_FILES = new Set([
  'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb',
  'check-secrets.mjs', 'smoke-api.mjs',
]);

// ── Patterns (descriptions only — actual regex, never printed) ─────────────────

const PATTERNS = [
  // AWS Access Key ID (high-confidence prefix pattern)
  { re: /\bAKIA[0-9A-Z]{16}\b/g, desc: 'AWS Access Key ID' },
  // AWS Secret Access Key in assignment context only (key = <40-char base64>)
  { re: /(?:secret[_-]?access[_-]?key|aws[_-]?secret|secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}['"]?/gi, desc: 'AWS Secret Key in assignment context' },
  // GCP Service Account private key header
  { re: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/, desc: 'GCP Service Account private key' },
  // Generic private key PEM
  { re: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PRIVATE)\s+KEY-----/, desc: 'Private key PEM header' },
  // JWT tokens (3-part base64url)
  { re: /\beyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, desc: 'JWT token (high confidence)' },
  // Hardcoded Bearer tokens
  { re: /['"]?\s*[Bb]earer\s+[A-Za-z0-9._\-+]{20,}/g, desc: 'Hardcoded Bearer token' },
  // Generic API key assignment
  { re: /(?:api[_-]?key|apikey|secret[_-]?key|api[_-]?secret|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9._\-]{16,}['"]/gi, desc: 'Hardcoded API key/secret/token' },
  // Connection strings with passwords
  { re: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/g, desc: 'MongoDB connection string with credentials' },
  { re: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/g, desc: 'PostgreSQL connection string with credentials' },
  { re: /mysql:\/\/[^:]+:[^@]+@/g, desc: 'MySQL connection string with credentials' },
  { re: /redis:\/\/[^:]+:[^@]+@/g, desc: 'Redis connection string with credentials' },
  // Password in assignment
  { re: /(?:password|passwd|pwd)\s*[:=]\s*['"](?!(?:$|\s*['"]))[^'"]{4,}['"]/gi, desc: 'Hardcoded password' },
  // Slack/Telegram/Discord webhook URLs
  { re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+/g, desc: 'Slack webhook URL' },
  // Private SSH key
  { re: /ssh-(?:rsa|dss|ed25519|ecdsa)\s+[A-Za-z0-9+/=]{40,}/g, desc: 'SSH private key' },
  // D1 database_id or similar (Cloudflare) — actual IDs
  { re: /database_id\s*=\s*['"][a-f0-9-]{20,}['"]/gi, desc: 'D1 database_id' },
  // Generic secret= in env/config (not template)
  { re: /(?<!\/\/|#)\s*[Ss]ecret\s*=\s*['"][A-Za-z0-9._\-+]{8,}['"]/g, desc: 'Hardcoded secret value' },
  // PinMe/Wrangler generated metadata can contain secret_text binding values.
  { re: /"type"\s*:\s*"secret_text"\s*,\s*"name"\s*:\s*"[^"]+"\s*,\s*"text"\s*:\s*"[^"\s]{16,}"/g, desc: 'secret_text binding in generated metadata' },
];

// ── Scanning ────────────────────────────────────────────────────────────────────

function shouldScanFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!SCAN_EXTENSIONS.has(ext)) return false;
  if (EXCLUDE_FILES.has(filePath.split('/').pop())) return false;
  return true;
}

function shouldScanDir(dirPath) {
  const name = dirPath.split('/').pop();
  if (EXCLUDE_DIRS.has(name)) return false;
  if (name.startsWith('.')) {
    // Allow .superpowers, .github, etc. but not .git
    if (name === '.git') return false;
  }
  return true;
}

function collectFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldScanDir(fullPath)) {
          results.push(...collectFiles(fullPath));
        }
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission denied or missing
  }
  return results;
}

/**
 * Check if a line is in a comment context (for .ts, .js, .vue, .mjs).
 * Returns true if the entire line is a comment.
 */
function isCommentLine(line, ext) {
  const trimmed = line.trimStart();
  if (['.ts', '.js', '.mjs', '.cjs', '.vue'].includes(ext)) {
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }
  if (['.yaml', '.yml'].includes(ext)) {
    return trimmed.startsWith('#');
  }
  if (ext === '.toml') {
    return trimmed.startsWith('#');
  }
  if (ext === '.env') {
    return trimmed.startsWith('#');
  }
  return false;
}

function scanFile(filePath) {
  const hits = [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = extname(filePath).toLowerCase();

    for (const { re, desc } of PATTERNS) {
      // Reset regex state
      re.lastIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line, ext)) continue;

        re.lastIndex = 0;
        const match = re.exec(line);
        if (match) {
          // Never store matchedText — only file, line, and description
          hits.push({ file: relative(ROOT_DIR, filePath), line: i + 1, desc });
          break; // One hit per pattern per file is enough
        }
      }
    }
  } catch {
    // Binary or permission error — skip
  }
  return hits;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function main() {
  log(`Scanning ${ROOT_DIR} for secrets...`);

  const files = collectFiles(ROOT_DIR);
  log(`Found ${files.length} scannable files.`);

  const allHits = [];
  for (const file of files) {
    const hits = scanFile(file);
    allHits.push(...hits);
  }

  if (allHits.length === 0) {
    log(`${GREEN}No secrets detected.${RESET}`);
    process.exit(0);
  }

  log(`${RED}SECRETS DETECTED (${allHits.length}):${RESET}`);
  for (const hit of allHits) {
    log(`  ${RED}✗${RESET} ${hit.file}:${hit.line} — ${hit.desc}`);
  }

  process.exit(1);
}

main();
