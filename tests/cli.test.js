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
  assert.match(run(home, 'help'), /source-search \[keywords\]/);
  assert.match(run(home, 'help'), /--source all\|meigen\|wallhaven/);
  assert.match(run(home, 'help'), /inspiration-import <image>/);
  assert.match(run(home, 'help'), /inspiration-update <asset>/);
  assert.match(run(home, 'help'), /inspiration-adopt <asset>/);
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

test('image source search returns inspectable links without stashing files', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-sources-'));
  mkdirSync(join(home, 'cache'), { recursive:true });
  writeFileSync(join(home, 'cache', 'image-prompts.json'), JSON.stringify([
    {
      id:'100', rank:1, prompt:'A colossal Chinese palace floating above a luminous sea of clouds.',
      author:'artist_example', likes:1200, views:30000,
      image:'https://images.example.com/palace.jpg', images:['https://images.example.com/palace.jpg'],
      model:'nanobanana', categories:['Illustration & 3D'], score:98, date:'2026-04-29',
      source_url:'https://x.com/artist_example/status/100',
    },
  ]));
  const response = JSON.parse(run(home, 'source-search', 'palace', '--source', 'meigen', '--model', 'nanobanana', '--full'));
  assert.deepEqual(response.errors, []);
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].title, 'Illustration & 3D · @artist_example');
  assert.equal(response.results[0].image_url, 'https://images.example.com/palace.jpg');
  assert.equal(response.results[0].prompt, 'A colossal Chinese palace floating above a luminous sea of clouds.');
  assert.deepEqual(response.results[0].stash, {
    url:'https://images.example.com/palace.jpg',
    title:'Illustration & 3D · @artist_example',
    source:'https://x.com/artist_example/status/100',
  });
  assert.equal(JSON.parse(run(home, 'source-list')).length, 3);
});

test('the global inspiration library classifies images and derives book assets without copying metadata', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-inspiration-'));
  const bundleFile = join(home, 'bundle.json');
  const imageFile = join(home, 'heaven.png');
  writeFileSync(bundleFile, JSON.stringify({ items:[
    { id:'111111111111111111111111111111110001', type:'book', data:{ title:'Test' } },
    { id:'222222222222222222222222222222220001', type:'location', parent:'111111111111111111111111111111110001', data:{ title:'Cloud Palace', slug:'cloud-palace' } },
  ], links:[] }));
  writeFileSync(imageFile, Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  run(home, 'import', bundleFile);
  const inspiration = JSON.parse(run(home, 'inspiration-import', imageFile, '--category', 'WLOP', '--title', 'Cloud court', '--tags', 'xianxia,clouds'));
  assert.equal(inspiration.type, 'inspiration_asset');
  assert.ok(readFileSync(join(home, inspiration.data.file)).equals(readFileSync(imageFile)));
  const catalog = JSON.parse(run(home, 'inspiration-list', '--category', 'wlop', '--tag', 'clouds'));
  assert.equal(catalog.assets.length, 1);
  assert.deepEqual(catalog.assets[0].tags, ['xianxia','clouds']);
  const adopted = JSON.parse(run(home, 'inspiration-adopt', inspiration.id, '--target', 'cloud-palace', '--title', 'Cloud court concept'));
  assert.equal(adopted.type, 'asset');
  assert.equal(adopted.parent, '111111111111111111111111111111110001');
  assert.match(run(home, 'links', 'cloud-palace'), new RegExp(`out\\tdepends\\t${adopted.id}`));
  assert.match(run(home, 'links', adopted.id), new RegExp(`out\\tderived_from\\t${inspiration.id}`));
  assert.deepEqual(JSON.parse(run(home, 'verify')).errors, []);
});

test('inspiration metadata supports optional two-level classification and versioned reverse prompts', () => {
  const home = mkdtempSync(join(tmpdir(), 'bookmontage-inspiration-metadata-'));
  const imageFile = join(home, 'portrait.png');
  const descriptionFile = join(home, 'description.txt');
  writeFileSync(imageFile, Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  writeFileSync(descriptionFile, '黑发绿眼女性，穿层叠黑纱长裙，侧光突出金属饰品。');
  const loose = JSON.parse(run(home, 'inspiration-import', imageFile, '--title', '待整理'));
  assert.equal(loose.parent, null);
  assert.deepEqual(JSON.parse(run(home, 'inspiration-list')).categories, []);
  const revised = JSON.parse(run(home, 'inspiration-update', loose.id,
    '--category', 'WLOP', '--subcategory', '翠眸角色', '--title', '黑纱肖像',
    '--types', '角色', '--tags', '绿眼,黑纱', '--description-file', descriptionFile));
  assert.match(revised.id, /0002$/);
  assert.deepEqual(revised.data.types, ['角色']);
  assert.equal(revised.data.detailed_description, '黑发绿眼女性，穿层叠黑纱长裙，侧光突出金属饰品。');
  const catalog = JSON.parse(run(home, 'inspiration-list', '--category', 'wlop', '--subcategory', '翠眸', '--type', '角色'));
  assert.equal(catalog.categories[0].title, 'WLOP');
  assert.equal(catalog.subcategories[0].title, '翠眸角色');
  assert.equal(catalog.assets.length, 1);
  assert.equal(catalog.assets[0].title, '黑纱肖像');
});
