import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const cli = new URL('../bin/bookmontage.js', import.meta.url).pathname;

function run(home, ...args) {
  return execFileSync(process.execPath, [cli, ...args], {
    env: { ...process.env, BOOKMONTAGE_HOME: home },
    encoding: 'utf8',
  });
}

test('init is repeatable and export stays a derived cache', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-init-'));
  run(home, 'init');
  run(home, 'init');
  const snapshot = JSON.parse(readFileSync(run(home, 'export').trim(), 'utf8'));
  assert.deepEqual(snapshot, { format: 1, items: [], links: [] });
});

test('revising an upstream item marks dependent work stale', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-version-'));
  const bundleFile = join(home, 'bundle.json');
  const patchFile = join(home, 'patch.json');
  writeFileSync(bundleFile, JSON.stringify({
    items: [
      { id: '111111111111111111111111111111110001', type: 'book', data: { title: 'Test' } },
      { id: '222222222222222222222222222222220001', type: 'character', parent: '111111111111111111111111111111110001', data: { title: 'Hero' } },
      { id: '333333333333333333333333333333330001', type: 'shot', parent: '111111111111111111111111111111110001', data: { title: 'Shot' } },
    ],
    links: [{ source: '333333333333333333333333333333330001', target: '222222222222222222222222222222220001', kind: 'depends' }],
  }));
  writeFileSync(patchFile, JSON.stringify({ design: 'revision two' }));
  run(home, 'import', bundleFile);
  assert.match(run(home, 'revise', '222222222222222222222222222222220001', patchFile), /0002/);
  const result = JSON.parse(run(home, 'verify'));
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /stale dependency/);
});

test('world relations share the link graph and remain independently editable', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-relations-'));
  const bundleFile = join(home, 'bundle.json');
  writeFileSync(bundleFile, JSON.stringify({
    items: [
      { id: '111111111111111111111111111111110001', type: 'book', data: { title: 'Test' } },
      { id: '222222222222222222222222222222220001', type: 'character', parent: '111111111111111111111111111111110001', data: { title: 'Hero', slug: 'hero' } },
      { id: '333333333333333333333333333333330001', type: 'faction', parent: '111111111111111111111111111111110001', data: { title: 'Guild', slug: 'guild' } },
    ],
    links: [],
  }));
  run(home, 'import', bundleFile);
  run(home, 'relate', 'hero', 'member_of', 'guild');
  assert.match(run(home, 'links', 'hero'), /out\tmember_of.*Guild/);
  assert.deepEqual(JSON.parse(run(home, 'verify')).warnings, []);
  run(home, 'unlink', 'hero', 'member_of', 'guild');
  assert.doesNotMatch(run(home, 'links', 'hero'), /member_of/);
});

test('stash keeps downloaded research in the disposable tmp library', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-stash-'));
  const bundleFile = join(home, 'bundle.json');
  writeFileSync(bundleFile, JSON.stringify({ items:[{ id:'111111111111111111111111111111110001', type:'book', data:{ title:'Test' } }], links:[] }));
  run(home, 'import', bundleFile);
  const id = run(home, 'stash', 'data:text/plain,source-note', '--title', 'Source note').trim();
  const item = JSON.parse(run(home, 'show', id));
  assert.equal(item.type, 'temp_asset');
  assert.equal(item.data.media_type, 'document');
  assert.equal(readFileSync(join(home, item.data.file), 'utf8'), 'source-note');
  assert.deepEqual(JSON.parse(run(home, 'verify')).errors, []);
});
