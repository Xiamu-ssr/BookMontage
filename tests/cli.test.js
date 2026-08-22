import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  assert.deepEqual(snapshot, { format: 1, data_root: home, items: [], links: [] });
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

test('help exposes the Seedance example search command', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-help-'));
  assert.match(run(home, 'help'), /prompt-search \[keywords\]/);
  assert.match(run(home, 'help'), /--model all\|2\.5\|2\.0/);
  assert.match(run(home, 'help'), /--tag action/);
  assert.match(run(home, 'help'), /prompt-facets/);
});

test('prompt search filters the live catalog by model, tags, author, kind, references and trend', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-prompts-'));
  mkdirSync(join(home, 'cache'), { recursive:true });
  writeFileSync(join(home, 'cache', 'seedance-prompts.json'), JSON.stringify({
    source:'fixture', license:'CC BY 4.0', scrapedAt:'2026-08-20T00:00:00Z', trendingIds:['1'], prompts:[
      { id:'1', slug:'xianxia-five-images', title:'Seedance 2.5 仙侠天宫', description:'五镜头仙侠短片', prompt:'仙侠人物在云层中高速打斗。', language:'zh', version:'2.5', promptKind:'r2v', authorName:'Soran', createdAt:'2026-08-16', tags:['scifi-fantasy','r2v'], references:['@Image 1','@Image 2','@Image 3','@Image 4','@Image 5'], videoUrl:'https://example.com/1.mp4' },
      { id:'2', slug:'classic-xianxia', title:'仙侠大战', description:'Seedance 2.0 经典仙侠打斗', prompt:'仙侠人物在山巅之间打斗。', language:'zh', authorName:'Classic', createdAt:'2026-01-01', tags:['action'], references:[], videoUrl:'https://example.com/2.mp4' },
      { id:'3', slug:'two-image-fight', title:'双图打斗', description:'动作参考', prompt:'两张图的动作场面。', language:'zh', version:'2.5', promptKind:'r2v', authorName:'Fighter', createdAt:'2026-08-17', tags:['action','r2v'], references:['@Image 1','@Image 2'], videoUrl:'https://example.com/3.mp4' },
    ],
  }));
  const native = JSON.parse(run(home, 'prompt-search', '仙侠', '--model', '2.5'));
  const classic = JSON.parse(run(home, 'prompt-search', '仙侠', '--model', '2.0'));
  assert.deepEqual(native.map(item => item.model), ['2.5']);
  assert.deepEqual(classic.map(item => item.model), ['2.0']);
  const exact = JSON.parse(run(home, 'prompt-search', '--model', '2.5', '--tag', 'scifi-fantasy', '--author', 'soran', '--kind', 'r2v', '--min-images', '5', '--full'));
  assert.equal(exact.length, 1);
  assert.equal(exact[0].reference_image_count, 5);
  assert.equal(exact[0].prompt, '仙侠人物在云层中高速打斗。');
  const trending = JSON.parse(run(home, 'prompt-search', '--trending'));
  assert.deepEqual(trending.map(item => item.id), ['1']);
  const facets = JSON.parse(run(home, 'prompt-facets', '--model', '2.5'));
  assert.deepEqual(facets.models, [{ value:'2.5', total:2 }]);
  assert.ok(facets.tags.some(item => item.value === 'r2v' && item.total === 2));
});
