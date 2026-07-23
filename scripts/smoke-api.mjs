#!/usr/bin/env node

/**
 * smoke-api.mjs — End-to-end smoke tests for fangdi-mobile Worker + Vite proxy.
 *
 * Usage:
 *   node scripts/smoke-api.mjs                        # start local Worker, run tests, clean up
 *   node scripts/smoke-api.mjs http://localhost:8787   # test supplied URL, no child process
 *
 * Tests:
 *   - Health endpoint
 *   - Public routes (home, notices, trade, lease)
 *   - Search invalid-input (BAD_REQUEST) and detail invalid-id (BAD_REQUEST)
 *   - CAPTCHA purpose validation and error contract
 *   - No-proxy check (unknown routes return NOT_FOUND, not upstream content)
 *   - Safe response headers
 *   - Sensitive data exposure
 *   - Child process cleanup
 */

import { spawn } from 'node:child_process';

// ── Configuration ──────────────────────────────────────────────────────────────

const WORKER_PORT = 8787;
const WORKER_URL = `http://localhost:${WORKER_PORT}`;
const WORKER_STARTUP_TIMEOUT_MS = 30_000;
const WORKER_HEALTH_RETRY_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;

// ── State ──────────────────────────────────────────────────────────────────────

let workerProcess = null;
let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;
const failures = [];

// ── Logging ────────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg) {
  process.stdout.write(`[smoke] ${msg}\n`);
}

function pass(name) {
  testsPassed++;
  testsTotal++;
  log(`${GREEN}PASS${RESET} ${name}`);
}

function fail(name, detail) {
  testsFailed++;
  testsTotal++;
  failures.push({ name, detail });
  log(`${RED}FAIL${RESET} ${name} — ${detail}`);
}

function skip(name, reason) {
  testsTotal++;
  log(reason
    ? `${YELLOW}SKIP${RESET} ${name} — ${reason}`
    : `${YELLOW}SKIP${RESET} ${name}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Fetch with timeout. Returns { response, body, headers } or throws.
 */
async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...opts,
      signal: controller.signal,
      redirect: 'manual',
    });
    const contentType = response.headers.get('content-type') || '';
    let body = null;
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
    return { response, body, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── D1 availability detection ─────────────────────────────────────────────────

/**
 * Detect whether the Worker has D1 (and CAPTCHA service) available.
 * Without D1, all CAPTCHA endpoints return INTERNAL_ERROR (500) immediately,
 * which means purpose-validation assertions (BAD_REQUEST vs INTERNAL_ERROR)
 * cannot be distinguished. Returns false when D1 is not available.
 */
async function detectD1Available(baseUrl) {
  try {
    const { response, body } = await fetchJson(`${baseUrl}/api/captcha?purpose=new-house`);
    // No D1 → 500 INTERNAL_ERROR. With D1 → 502 UPSTREAM_BLOCKED (adapter not implemented).
    if (response.status === 500 && body?.error?.code === 'INTERNAL_ERROR') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Worker lifecycle ───────────────────────────────────────────────────────────

function startWorker() {
  return new Promise((resolve, reject) => {
    log(`Starting wrangler dev on port ${WORKER_PORT}...`);

    const projectDir = new URL('..', import.meta.url).pathname;
    const backendDir = `${projectDir}backend`;
    log(`Backend dir: ${backendDir}`);

    workerProcess = spawn('npx', [
      'wrangler', 'dev',
      '--config', 'wrangler.toml',
      '--port', String(WORKER_PORT),
    ], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let resolved = false;

    const startupTimer = setTimeout(() => {
      resolved = true;
      clearTimeout(startupTimer);
      log('Startup timeout — will let caller clean up worker...');
      reject(new Error(`Worker did not start within ${WORKER_STARTUP_TIMEOUT_MS}ms`));
    }, WORKER_STARTUP_TIMEOUT_MS);
    const allOutput = [];

    workerProcess.stdout.on('data', (data) => {
      const text = data.toString();
      allOutput.push(`[stdout] ${text.trim()}`);
      // Wrangler outputs "Ready" or similar on successful startup
      if (!resolved && (text.includes('Ready') || text.includes('http://'))) {
        resolved = true;
        clearTimeout(startupTimer);
        // Give it a moment to stabilize
        setTimeout(() => resolve(), 1000);
      }
    });

    workerProcess.stderr.on('data', (data) => {
      const text = data.toString();
      allOutput.push(`[stderr] ${text.trim()}`);
      log(`[wrangler stderr] ${text.trim()}`);
    });

    workerProcess.on('error', (err) => {
      clearTimeout(startupTimer);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Worker spawn error: ${err.message}`));
      }
    });

    workerProcess.on('exit', (code) => {
      clearTimeout(startupTimer);
      if (!resolved) {
        resolved = true;
        log(`Worker exited with code ${code}. Output:`);
        for (const line of allOutput.slice(-20)) log(`  ${line}`);
        reject(new Error(`Worker exited with code ${code} before startup`));
      }
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = WORKER_STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { response, body } = await fetchJson(`${baseUrl}/api/health`);
      if (response.status === 200 && body?.ok) return true;
    } catch {
      // Worker not ready yet
    }
    await new Promise((r) => setTimeout(r, WORKER_HEALTH_RETRY_MS));
  }
  return false;
}

/**
 * Stop the worker process gracefully: SIGTERM first, then SIGKILL after 3s.
 * Awaits the process exit event. Falls back to resolve after 6s.
 */
function stopWorker() {
  return new Promise((resolve) => {
    if (!workerProcess || workerProcess.exitCode !== null) {
      workerProcess = null;
      return resolve();
    }
    log('Stopping worker...');
    const proc = workerProcess;
    workerProcess = null;

    const forceKill = setTimeout(() => {
      if (!proc.killed) {
        log('Sending SIGKILL...');
        proc.kill('SIGKILL');
      }
    }, 3000);

    // Resolve on exit or after 6s fallback
    const fallback = setTimeout(() => {
      clearTimeout(forceKill);
      log('Worker stop timeout — proceeding.');
      resolve();
    }, 6000);

    proc.on('exit', () => {
      clearTimeout(forceKill);
      clearTimeout(fallback);
      log('Worker stopped.');
      resolve();
    });

    proc.kill('SIGTERM');
  });
}

// ── Test cases ─────────────────────────────────────────────────────────────────

async function testHealth(baseUrl) {
  log(`\n${CYAN}── Health endpoint${RESET}`);

  // Test 1: health returns 200 ok
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/health`);
    assert(response.status === 200, `status=${response.status}`);
    assert(body?.ok === true, `ok=${body?.ok}`);
    assert(body?.data?.service === 'fangdi-mobile-api', `service=${body?.data?.service}`);
    assert(body?.data?.status === 'ok', `status field=${body?.data?.status}`);
    pass('GET /api/health — 200 ok');
  }

  // Test 2: health with OPTIONS returns 204
  {
    const { response } = await fetchJson(`${baseUrl}/api/health`, { method: 'OPTIONS' });
    assert(response.status === 204, `OPTIONS status=${response.status}`);
    pass('OPTIONS /api/health — 204');
  }

  // Test 3: health with POST returns NOT_FOUND (exact method+path routing)
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/health`, { method: 'POST' });
    assert(response.status === 404, `POST status=${response.status}`);
    assert(body?.ok === false, 'not ok envelope');
    assert(body?.error?.code === 'NOT_FOUND', `code=${body?.error?.code}`);
    pass('POST /api/health — 404 NOT_FOUND');
  }
}

async function testPublicRoutes(baseUrl) {
  log(`\n${CYAN}── Public routes${RESET}`);

  // Test 4: home
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/home`);
    const valid = body?.ok === true || (body?.ok === false && body?.error?.code);
    assert(valid, 'home has valid envelope');
    const status = response.status;
    assert([200, 502, 504].includes(status), `home status=${status}`);
    pass(`GET /api/home — status ${status} with valid envelope`);
  }

  // Test 5: notices with valid params
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/notices?kind=proclamation&page=1&pageSize=5`);
    assert(body?.ok !== undefined, 'notices envelope exists');
    // Notices hits upstream: allow 200 ok or upstream error codes
    const allowedStatuses = [200, 502, 504];
    const allowedErrorCodes = ['UPSTREAM_BLOCKED', 'UPSTREAM_TIMEOUT', 'UPSTREAM_BAD_STATUS', 'UPSTREAM_SCHEMA'];
    assert(allowedStatuses.includes(response.status), `notices status=${response.status}, expected one of ${allowedStatuses.join(',')}`);
    if (body?.ok === false) {
      assert(allowedErrorCodes.includes(body?.error?.code),
        `notices error code=${body?.error?.code}, expected one of ${allowedErrorCodes.join(',')}`);
    }
    pass(`GET /api/notices — status ${response.status}, code=${body?.ok ? 'ok' : body?.error?.code}`);
  }

  // Test 6: notices with invalid kind → BAD_REQUEST
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/notices?kind=bogus&page=1&pageSize=5`);
    assert(response.status === 400, `invalid kind status=${response.status}, expected 400`);
    assert(body?.ok === false, 'invalid kind must fail');
    assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
    pass('GET /api/notices?kind=bogus — 400 BAD_REQUEST');
  }

  // Test 7: trade
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/trade`);
    const valid = body?.ok === true || (body?.ok === false && body?.error?.code);
    assert(valid, 'trade has valid envelope');
    pass(`GET /api/trade — status ${response.status}`);
  }

  // Test 8: lease (static data, no upstream dependency)
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/lease`);
    assert(response.status === 200, `lease status=${response.status}, expected 200 (static route)`);
    assert(body?.ok === true, `lease ok=${body?.ok}, expected true (static route)`);
    assert(body?.data !== undefined, 'lease data must be present (static route)');
    pass(`GET /api/lease — 200 ok (static)`);
  }
}

async function testSearchInvalid(baseUrl, d1Available) {
  log(`\n${CYAN}── Search invalid-input tests${RESET}`);

  // Test 9: new-house search with invalid body (missing required fields)
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/new-house/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 5, district: '!!invalid!!' }),
    });
    // district "!!invalid!!" passes validation (arbitrary string), hits upstream
    assert(body?.ok === false, 'invalid search should fail — upstream blocked');
    // Upstream is blocked locally: expect 502/504 with upstream error code
    const allowedStatuses = [502, 504];
    const allowedErrorCodes = ['UPSTREAM_BLOCKED', 'UPSTREAM_TIMEOUT', 'UPSTREAM_BAD_STATUS'];
    assert(allowedStatuses.includes(response.status),
      `search test 9 status=${response.status}, expected one of ${allowedStatuses.join(',')}`);
    assert(allowedErrorCodes.includes(body?.error?.code),
      `error code=${body?.error?.code}, expected one of ${allowedErrorCodes.join(',')}`);
    pass(`POST /api/new-house/search invalid — status ${response.status} code=${body?.error?.code}`);
  }

  // Test 10: new-house search with empty body → BAD_REQUEST
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/new-house/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(response.status === 400, `empty body status=${response.status}, expected 400`);
    assert(body?.ok === false, 'empty search should fail');
    assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
    pass('POST /api/new-house/search empty — 400 BAD_REQUEST');
  }

  // Test 11: old-house search with invalid captchaSession
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/old-house/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        pageSize: 5,
        captchaSession: 'nonexistent-12345',
        captchaText: 'abcd',
      }),
    });
    assert(body?.ok === false, 'invalid captcha should fail');

    if (!d1Available) {
      // No D1: captcha validation is unreachable; returns INTERNAL_ERROR
      assert(response.status === 500, `no-D1 status=${response.status}, expected 500`);
      assert(body?.error?.code === 'INTERNAL_ERROR', `no-D1 code=${body?.error?.code}`);
      pass('POST /api/old-house/search invalid captcha — 500 INTERNAL_ERROR (no D1)');
    } else {
      assert(body?.error?.code, `error code should be present`);
      pass(`POST /api/old-house/search invalid captcha — status ${response.status} code=${body?.error?.code}`);
    }
  }

  // Test 12: new-house search with non-JSON body → BAD_REQUEST
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/new-house/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    assert(response.status === 400, `non-JSON status=${response.status}, expected 400`);
    assert(body?.ok === false, 'non-JSON should fail');
    assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
    pass('POST /api/new-house/search non-JSON — 400 BAD_REQUEST');
  }
}

async function testDetailInvalid(baseUrl) {
  log(`\n${CYAN}── Detail invalid-id tests${RESET}`);

  // Test 13: new-house detail with invalid id (spaces)
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/new-house/invalid id with spaces`);
    assert(response.status === 400, `invalid id status=${response.status}, expected 400`);
    assert(body?.ok === false, 'invalid id should fail');
    assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
    pass('GET /api/new-house/bad-id — 400 BAD_REQUEST');
  }

  // Test 14: new-house detail with valid-format but nonexistent id
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/new-house/nonexistent-99999`);
    assert(body?.ok !== undefined, 'envelope exists');
    assert(body?.error?.code, `error code present: ${body?.error?.code}`);
    const allowed = ['UPSTREAM_BLOCKED', 'UPSTREAM_TIMEOUT', 'UPSTREAM_BAD_STATUS', 'NOT_FOUND'];
    assert(allowed.includes(body?.ok === false ? body?.error?.code : ''), `acceptable code`);
    pass(`GET /api/new-house/nonexistent-99999 — status ${response.status}`);
  }

  // Test 15: old-house detail with invalid id (too long)
  {
    const longId = 'a'.repeat(81);
    const { response, body } = await fetchJson(`${baseUrl}/api/old-house/${longId}`);
    assert(response.status === 400, `too-long id status=${response.status}, expected 400`);
    assert(body?.ok === false, 'too-long id should fail');
    assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
    pass('GET /api/old-house/too-long — 400 BAD_REQUEST');
  }
}

async function testCaptcha(baseUrl, d1Available) {
  log(`\n${CYAN}── CAPTCHA purpose/error tests${RESET}`);

  // Test 16: captcha with valid purpose
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/captcha?purpose=new-house`);
    assert(body?.ok !== undefined, 'captcha envelope exists');

    if (!d1Available) {
      assert(response.status === 500, `no-D1 captcha status=${response.status}, expected 500`);
      assert(body?.error?.code === 'INTERNAL_ERROR', `no-D1 captcha code=${body?.error?.code}`);
      pass('GET /api/captcha — 500 INTERNAL_ERROR (no D1)');
    } else {
      const okCodes = ['UPSTREAM_BLOCKED', 'INTERNAL_ERROR', 'CAPTCHA_REQUIRED', 'RATE_LIMITED'];
      if (body?.ok === false) {
        assert(okCodes.includes(body?.error?.code),
          `captcha error code=${body?.error?.code}, expected one of ${okCodes.join(',')}`);
      }
      pass(`GET /api/captcha — status ${response.status}, code=${body?.ok ? 'ok' : body?.error?.code}`);
    }
  }

  // Test 17: captcha with invalid purpose → BAD_REQUEST (D1) or INTERNAL_ERROR (no D1)
  {
    if (!d1Available) {
      skip('GET /api/captcha?purpose=bogus — purpose validation unreachable without D1; purpose check returns INTERNAL_ERROR before validation');
    } else {
      const { response, body } = await fetchJson(`${baseUrl}/api/captcha?purpose=bogus`);
      assert(response.status === 400, `invalid purpose status=${response.status}, expected 400`);
      assert(body?.ok === false, 'invalid purpose should fail');
      assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
      pass('GET /api/captcha?purpose=bogus — 400 BAD_REQUEST');
    }
  }

  // Test 18: captcha with missing purpose → BAD_REQUEST (D1) or INTERNAL_ERROR (no D1)
  {
    if (!d1Available) {
      skip('GET /api/captcha (no purpose) — purpose validation unreachable without D1; purpose check returns INTERNAL_ERROR before validation');
    } else {
      const { response, body } = await fetchJson(`${baseUrl}/api/captcha`);
      assert(response.status === 400, `missing purpose status=${response.status}, expected 400`);
      assert(body?.ok === false, 'missing purpose should fail');
      assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
      pass('GET /api/captcha (no purpose) — 400 BAD_REQUEST');
    }
  }

  // Test 19: captcha refresh with invalid sessionId
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/captcha/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'bad!id' }),
    });
    assert(body?.ok === false, 'invalid session should fail');

    if (!d1Available) {
      assert(response.status === 500, `no-D1 refresh status=${response.status}, expected 500`);
      assert(body?.error?.code === 'INTERNAL_ERROR', `code=${body?.error?.code}`);
      pass('POST /api/captcha/refresh invalid — 500 INTERNAL_ERROR (no D1)');
    } else {
      // With D1: sessionId validation runs — 'bad!id' fails validateId → BAD_REQUEST
      assert(response.status === 400, `refresh status=${response.status}, expected 400`);
      assert(body?.error?.code === 'BAD_REQUEST', `code=${body?.error?.code}`);
      pass('POST /api/captcha/refresh invalid — 400 BAD_REQUEST');
    }
  }
}

async function testNoProxy(baseUrl) {
  log(`\n${CYAN}── No-proxy checks${RESET}`);

  // Test 20: arbitrary path returns NOT_FOUND
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/arbitrary-proxy-path`);
    assert(response.status === 404, `status=${response.status}`);
    assert(body?.ok === false, 'not ok');
    assert(body?.error?.code === 'NOT_FOUND', `code=${body?.error?.code}`);
    pass('GET /api/arbitrary — 404 NOT_FOUND');
  }

  // Test 21: path traversal attempt returns NOT_FOUND
  {
    const { response, body } = await fetchJson(`${baseUrl}/api/../../etc/passwd`);
    assert(response.status === 404, `traversal status=${response.status}, expected 404`);
    assert(body?.ok === false, 'traversal not ok');
    assert(body?.error?.code === 'NOT_FOUND', `code=${body?.error?.code}`);
    pass('GET /api/../../etc/passwd — 404 NOT_FOUND');
  }

  // Test 22: root returns NOT_FOUND (Worker handles /api/* only)
  {
    const { response, body } = await fetchJson(`${baseUrl}/`);
    assert(response.status === 404, `root status=${response.status}, expected 404`);
    assert(body?.ok === false, 'root not ok');
    assert(body?.error?.code === 'NOT_FOUND', `code=${body?.error?.code}`);
    pass('GET / (root) — 404 NOT_FOUND');
  }
}

async function testSafeHeaders(baseUrl) {
  log(`\n${CYAN}── Safe response headers${RESET}`);

  // Test 23: Content-Type is JSON
  {
    const { response } = await fetchJson(`${baseUrl}/api/health`);
    const ct = response.headers.get('content-type') || '';
    assert(ct.includes('application/json'), `Content-Type=${ct}`);
    pass('Content-Type: application/json');
  }

  // Test 24: X-Content-Type-Options present
  {
    const { headers } = await fetchJson(`${baseUrl}/api/health`);
    const nosniff = headers.get('x-content-type-options');
    assert(nosniff === 'nosniff', `X-Content-Type-Options=${nosniff}`);
    pass('X-Content-Type-Options: nosniff');
  }

  // Test 25: no upstream cookie passthrough; allow Cloudflare edge cookies.
  {
    const { headers } = await fetchJson(`${baseUrl}/api/home`);
    const setCookie = headers.get('set-cookie');
    const cookieNames = setCookie
      ? setCookie.split(/,\s*(?=[^;,]+=)/).map((cookie) => cookie.split('=', 1)[0].trim().toLowerCase())
      : [];
    const allowedEdgeCookies = new Set(['__cf_bm', '__cflb', 'cf_clearance']);
    const unexpected = cookieNames.filter((name) => !allowedEdgeCookies.has(name));
    assert(unexpected.length === 0, `unexpected upstream cookie names: ${unexpected.join(', ')}`);
    pass(setCookie ? 'No upstream cookies (Cloudflare edge cookie allowed)' : 'No Set-Cookie header');
  }

  // Test 26: No upstream Server header
  {
    const { headers } = await fetchJson(`${baseUrl}/api/home`);
    // Cloudflare Worker may add its own CF-* headers, but should not leak upstream server
    // We check that raw upstream server identifiers are not present
    const server = headers.get('server');
    const isSafe = !server || !/(nginx|apache|tomcat|fangdi)/i.test(server);
    assert(isSafe, `Server header safe: ${server}`);
    pass('No upstream Server header leak');
  }

  // Test 27: No X-Powered-By
  {
    const { headers } = await fetchJson(`${baseUrl}/api/health`);
    const powered = headers.get('x-powered-by');
    assert(!powered, `X-Powered-By should be absent: ${powered}`);
    pass('No X-Powered-By header');
  }
}

// ── Sensitive data check ───────────────────────────────────────────────────────

async function testNoSensitiveData(baseUrl) {
  log(`\n${CYAN}── Sensitive data exposure${RESET}`);

  const SENSITIVE_PATTERNS = [
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, // JWT
    /(?:cookie|session|token|secret|password|passwd|api[_-]?key)/i,
    /fangdi\.com\.cn\/.*[?&](?:token|key|secret|passwd)=/,
    /Set-Cookie/i,
  ];

  const paths = ['/api/health', '/api/home'];
  for (const path of paths) {
    try {
      const { body } = await fetchJson(`${baseUrl}${path}`);

      // Stringify for pattern matching
      const rawText = typeof body === 'string' ? body : JSON.stringify(body);

      let clean = true;
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(rawText)) {
          clean = false;
          break;
        }
      }
      assert(clean, `${path} no sensitive patterns in response`);
      pass(`${path} — no sensitive data exposed`);
    } catch (err) {
      fail(`${path} sensitive check`, err.message);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const suppliedUrl = args[0];
  let baseUrl = suppliedUrl;
  let ownWorker = false;

  if (!suppliedUrl) {
    ownWorker = true;
    try {
      await startWorker();
    } catch (err) {
      log(`${RED}FATAL: ${err.message}${RESET}`);
      // Ensure spawned process is cleaned up — stopWorker handles exitCode/null/kill fallback
      await stopWorker();
      process.exit(1);
    }

    log('Waiting for Worker health check...');
    const healthy = await waitForHealth(WORKER_URL);
    if (!healthy) {
      log(`${RED}FATAL: Worker did not become healthy${RESET}`);
      await stopWorker();
      process.exit(1);
    }
    baseUrl = WORKER_URL;
  }

  log(`${CYAN}Testing against: ${baseUrl}${RESET}`);

  // Detect D1 availability for CAPTCHA tests
  const d1Available = await detectD1Available(baseUrl);
  log(`D1/CAPTCHA service: ${d1Available ? 'available' : 'NOT available'} (${d1Available ? 'full assertions' : 'purpose-validation skipped'})`);

  try {
    await testHealth(baseUrl);
    await testPublicRoutes(baseUrl);
    await testSearchInvalid(baseUrl, d1Available);
    await testDetailInvalid(baseUrl);
    await testCaptcha(baseUrl, d1Available);
    await testNoProxy(baseUrl);
    await testSafeHeaders(baseUrl);
    await testNoSensitiveData(baseUrl);
  } catch (err) {
    fail('unhandled', err.message);
  } finally {
    if (ownWorker) {
      await stopWorker();
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log('');
  log(`${CYAN}══════════════════════════════════════${RESET}`);
  log(`Results: ${testsPassed} passed, ${testsFailed} failed, ${testsTotal} total`);
  if (failures.length > 0) {
    log(`${RED}Failures:${RESET}`);
    for (const f of failures) {
      log(`  ${RED}✗${RESET} ${f.name}: ${f.detail}`);
    }
  }
  log(`${CYAN}══════════════════════════════════════${RESET}`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

// ── Cleanup on interrupt ──────────────────────────────────────────────────────

process.on('SIGINT', () => {
  stopWorker().then(() => process.exit(130));
});

process.on('SIGTERM', () => {
  stopWorker().then(() => process.exit(143));
});

main();
