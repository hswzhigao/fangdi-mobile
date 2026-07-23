#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const fixturePath = join(root, 'backend', `.secret-scan-fixture-${process.pid}.json`);
const scannerPath = join(root, 'scripts', 'check-secrets.mjs');
const fakeSecret = 'f'.repeat(32);

test('detects generated secret_text metadata without printing its value', () => {
  assert.equal(existsSync(fixturePath), false, 'fixture path must not already exist');
  writeFileSync(
    fixturePath,
    JSON.stringify({
      bindings: [{ type: 'secret_text', name: 'API_KEY', text: fakeSecret }],
    }),
  );

  try {
    const result = spawnSync(process.execPath, [scannerPath], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, `scanner should fail: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /secret_text binding/i);
    assert.equal(result.stdout.includes(fakeSecret), false, 'secret value must not be printed');
  } finally {
    rmSync(fixturePath, { force: true });
  }
});
