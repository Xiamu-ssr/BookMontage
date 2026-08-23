#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { searchSources, sourceCatalogs } from '../lib/sources.js';
import { cacheRoot, dataRoot, exportSnapshot, findItem, importBundle, initialize, logicalId, makeId, openStore, putItem, putLink, reviseItem, tmpRoot, verifyStore } from '../lib/store.js';

const [command = 'help', ...args] = process.argv.slice(2);

function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

function help() {
  console.log(`BookMontage — a tiny local story-world workbench

  bookmontage init
  bookmontage import <bundle.json>
  bookmontage export
  bookmontage list [type]
  bookmontage show <id|slug|path>
  bookmontage prompt <id|slug|path>
  bookmontage prompt-search [keywords] [--model all|2.5|2.0] [--lang all|zh|en|ja|ko]
    [--tag action] [--author Soran] [--kind r2v] [--min-images 5]
    [--trending] [--sort relevance|newest|oldest] [--limit 5] [--full] [--refresh]
  bookmontage prompt-facets [--model all|2.5|2.0] [--lang all|zh|en|ja|ko] [--refresh]
  bookmontage source-list
  bookmontage source-search [keywords] [--source all|meigen|wallhaven]
    [--model all|gptimage|nanobanana] [--category <name>]
    [--sort relevance|popular|newest|random] [--limit 6] [--page 1]
    [--atleast 1920x1080] [--ratio 16x9] [--color 66ccff]
    [--proxy http://127.0.0.1:7890] [--full] [--refresh]
  bookmontage revise <id> <patch.json>
  bookmontage links <id|slug|path>
  bookmontage relate <source> <kind> <target>
  bookmontage unlink <source> <kind> <target>
  bookmontage stash <url> --title <name> [--source <page>] [--book <selector>]
  bookmontage verify
  bookmontage doctor
  bookmontage generate <shot-id> [--model bytedance/doubao-seedance-2.0] [--duration 10] [--resolution 720p]
  bookmontage compose <chapter-id>
`);
}

const seedanceCatalogUrl = 'https://seedance2prompts.com/data/prompts.json';
const seedanceCatalogHome = 'https://seedance2prompts.com';

function normalizedVersion(entry) { return entry.version === '2.5' ? '2.5' : '2.0'; }
function normalizedKind(entry) { return entry.promptKind || ((entry.references || []).length ? 'r2v' : 't2v'); }
function optionValues(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === `--${name}` && args[index + 1]) values.push(...args[index + 1].split(','));
  }
  return values.map(value => value.trim().toLowerCase()).filter(Boolean);
}
function referenceImageCount(references = []) {
  const indexes = new Set();
  for (const reference of references) {
    const range = String(reference).match(/@(?:Images?|图片)\s*(\d+)\s*(?:to|[-–—至])\s*(\d+)/i);
    if (range) {
      const start = Number(range[1]); const end = Number(range[2]);
      for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) indexes.add(value);
      continue;
    }
    const single = String(reference).match(/@(?:Image|图片)\s*(\d+)/i);
    if (single) indexes.add(Number(single[1]));
  }
  return indexes.size;
}
function validatePromptFilters() {
  const model = flag('model', 'all');
  const language = flag('lang', 'all');
  const sort = flag('sort', 'relevance');
  if (!['all','2.5','2.0'].includes(model)) throw new Error('--model must be all, 2.5, or 2.0');
  if (!['all','zh','en','ja','ko'].includes(language)) throw new Error('--lang must be all, zh, en, ja, or ko');
  if (!['relevance','newest','oldest'].includes(sort)) throw new Error('--sort must be relevance, newest, or oldest');
  return { model, language, sort };
}
async function loadSeedanceCatalog() {
  const cacheFile = join(cacheRoot, 'seedance-prompts.json');
  const fresh = existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < 6 * 60 * 60 * 1000;
  if (fresh && !args.includes('--refresh')) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  try {
    const response = await fetch(seedanceCatalogUrl, { headers:{ 'User-Agent':'BookMontage/0.1 (+prompt research; CC BY 4.0)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.prompts)) throw new Error('catalog has no prompts array');
    mkdirSync(cacheRoot, { recursive:true });
    writeFileSync(cacheFile, JSON.stringify(catalog));
    return catalog;
  } catch (error) {
    if (!existsSync(cacheFile)) throw new Error(`Seedance prompt catalog unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }
}
function filterSeedanceEntries(catalog, { model, language }) {
  const tags = optionValues('tag');
  const authors = optionValues('author');
  const kinds = optionValues('kind');
  const minImages = Math.max(0, Number(flag('min-images', '0')) || 0);
  const trendingOnly = args.includes('--trending');
  const trendingIds = new Set((catalog.trendingIds || []).map(String));
  return catalog.prompts.filter(entry => {
    const entryTags = (entry.tags || []).map(tag => String(tag).toLowerCase());
    const author = String(entry.authorName || '').toLowerCase();
    return (model === 'all' || normalizedVersion(entry) === model)
      && (language === 'all' || entry.language === language)
      && tags.every(tag => entryTags.includes(tag))
      && authors.every(value => author.includes(value))
      && kinds.every(kind => normalizedKind(entry) === kind)
      && referenceImageCount(entry.references) >= minImages
      && (!trendingOnly || trendingIds.has(String(entry.id)));
  });
}
async function seedancePromptSearch(query = '') {
  const filters = validatePromptFilters();
  const catalog = await loadSeedanceCatalog();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const trendingOrder = new Map((catalog.trendingIds || []).map((id, index) => [String(id), index]));
  const matches = filterSeedanceEntries(catalog, filters).map(entry => {
    const title = String(entry.title || '');
    const description = String(entry.description || '');
    const prompt = String(entry.prompt || '');
    const author = String(entry.authorName || '');
    const tags = entry.tags || [];
    const score = terms.reduce((total, term) => total
      + (title.toLowerCase().includes(term) ? 8 : 0)
      + (tags.some(tag => String(tag).toLowerCase().includes(term)) ? 5 : 0)
      + (description.toLowerCase().includes(term) ? 3 : 0)
      + (author.toLowerCase().includes(term) ? 2 : 0)
      + (prompt.toLowerCase().includes(term) ? 1 : 0), 0);
    return { ...entry, score, imageCount:referenceImageCount(entry.references), trendingRank:trendingOrder.get(String(entry.id)) ?? Number.MAX_SAFE_INTEGER };
  }).filter(entry => terms.length === 0 || entry.score > 0);
  const effectiveSort = args.includes('--trending') && !args.includes('--sort') ? 'trending' : filters.sort;
  matches.sort((left, right) => {
    if (effectiveSort === 'trending') return left.trendingRank - right.trendingRank;
    if (effectiveSort === 'newest') return String(right.createdAt || '').localeCompare(String(left.createdAt || '')) || right.score - left.score;
    if (effectiveSort === 'oldest') return String(left.createdAt || '').localeCompare(String(right.createdAt || '')) || right.score - left.score;
    return right.score - left.score || String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
  const limit = Math.max(1, Math.min(50, Number(flag('limit', '5')) || 5));
  const full = args.includes('--full');
  return matches.slice(0, limit).map(entry => ({
    id:entry.id,
    slug:entry.slug,
    model:normalizedVersion(entry),
    prompt_kind:normalizedKind(entry),
    language:entry.language,
    title:entry.title,
    description:entry.description,
    author:entry.authorName,
    author_url:entry.authorLink,
    published_at:entry.createdAt,
    tags:entry.tags || [],
    references:entry.references || [],
    reference_image_count:entry.imageCount,
    video_url:entry.videoUrl,
    thumbnail:entry.thumbnail,
    page_url:`${seedanceCatalogHome}/${entry.language === 'zh' ? 'zh/' : ''}prompts/${entry.slug}`,
    source_url:entry.sourceUrl,
    rank:entry.score,
    ...(full ? { prompt:entry.prompt } : { prompt_excerpt:`${String(entry.prompt || '').slice(0, 360)}${String(entry.prompt || '').length > 360 ? '…' : ''}` }),
    catalog:seedanceCatalogHome,
    source:catalog.source,
    license:catalog.license,
  }));
}

async function seedancePromptFacets() {
  const filters = validatePromptFilters();
  const catalog = await loadSeedanceCatalog();
  const entries = filterSeedanceEntries(catalog, filters);
  const count = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, total]) => ({ value, total }));
  return {
    total:entries.length,
    updated_at:catalog.scrapedAt,
    models:count(entries.map(normalizedVersion)),
    languages:count(entries.map(entry => entry.language || 'unknown')),
    prompt_kinds:count(entries.map(normalizedKind)),
    tags:count(entries.flatMap(entry => entry.tags || [])),
    authors:count(entries.map(entry => entry.authorName || 'unknown')).slice(0, 100),
    catalog:seedanceCatalogHome,
  };
}

const mimeExtensions = {
  'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp', 'image/gif':'.gif',
  'video/mp4':'.mp4', 'video/webm':'.webm', 'application/pdf':'.pdf',
  'text/plain':'.txt', 'text/markdown':'.md', 'application/json':'.json',
};

async function stashRemote(url) {
  const response = await fetch(url, { headers:{ 'User-Agent':'BookMontage/0.1 (+local research library)' }, redirect:'follow' });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const mime = String(response.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase();
  const urlExtension = extname(new URL(response.url).pathname).toLowerCase();
  const extension = mimeExtensions[mime] || (/^\.[a-z0-9]{1,6}$/.test(urlExtension) ? urlExtension : '.bin');
  const mediaType = mime === 'image/gif' ? 'gif' : mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';
  const id = makeId();
  const filename = `${id}${extension}`;
  writeFileSync(join(tmpRoot, filename), Buffer.from(await response.arrayBuffer()));
  const db = openStore();
  const bookSelector = flag('book');
  const book = bookSelector ? findItem(db, bookSelector) : (() => {
    const row = db.prepare("SELECT id,type,parent,data FROM item WHERE type='book' ORDER BY rowid LIMIT 1").get();
    return row ? { ...row, data:JSON.parse(row.data) } : null;
  })();
  if (!book) { db.close(); throw new Error('No book exists for this temporary asset'); }
  const title = flag('title', decodeURIComponent(new URL(response.url).pathname.split('/').pop() || '网络素材'));
  putItem(db, { id, type:'temp_asset', parent:book.id, data:{
    title, slug:flag('slug'), file:`tmp/${filename}`, mime, media_type:mediaType,
    source_url:url, source_page:flag('source'), note:flag('note'),
  } });
  db.close();
  exportSnapshot();
  return id;
}

function relationCommand(mode, sourceSelector, kind, targetSelector) {
  if (!/^[a-z][a-z0-9_]*$/.test(kind || '')) throw new Error(`Invalid relation kind: ${kind}`);
  if (['depends','derived_from','relates'].includes(kind)) throw new Error(`${kind} is reserved for production links`);
  const db = openStore();
  const source = findItem(db, sourceSelector);
  const target = findItem(db, targetSelector);
  if (mode === 'add') putLink(db, { source:source.id, target:target.id, kind });
  else db.prepare('DELETE FROM link WHERE source=? AND target=? AND kind=?').run(source.id, target.id, kind);
  db.close();
  exportSnapshot();
  return `${source.data.title || source.id}\t${kind}\t${target.data.title || target.id}`;
}

function listItemLinks(selector) {
  const db = openStore();
  const item = findItem(db, selector);
  const rows = db.prepare(`
    SELECT 'out' direction,l.kind,i.id,i.data FROM link l JOIN item i ON i.id=l.target WHERE l.source=?
    UNION ALL
    SELECT 'in' direction,l.kind,i.id,i.data FROM link l JOIN item i ON i.id=l.source WHERE l.target=?
    ORDER BY direction,kind
  `).all(item.id, item.id);
  db.close();
  return rows.map(row => `${row.direction}\t${row.kind}\t${row.id}\t${JSON.parse(row.data).title || ''}`).join('\n');
}

function composeChapter(selector) {
  const db = openStore();
  const chapter = findItem(db, selector);
  if (chapter.type !== 'chapter') throw new Error(`${selector} is not a chapter`);
  const shotVersions = db.prepare("SELECT id,data FROM item WHERE parent=? AND type='shot' ORDER BY rowid").all(chapter.id);
  const latestShots = new Map();
  for (const shot of shotVersions) latestShots.set(logicalId(shot.id), shot);
  const shots = [...latestShots.values()];
  const clips = shots.map(shot => {
    const clip = db.prepare("SELECT id,data FROM item WHERE parent=? AND type='clip' ORDER BY rowid DESC LIMIT 1").get(shot.id);
    if (!clip) throw new Error(`Missing candidate clip for ${JSON.parse(shot.data).title}`);
    return { ...clip, data:JSON.parse(clip.data) };
  });
  db.close();
  const work = mkdtempSync(join(tmpdir(), 'bookmontage-compose-'));
  try {
    const concatFile = join(work, 'clips.txt');
    writeFileSync(concatFile, clips.map(clip => `file '${join(dataRoot, clip.data.file).replaceAll("'", "'\\''")}'`).join('\n'));
    const id = makeId();
    const relativeFile = `assets/${id}.mp4`;
    execFileSync('ffmpeg', [
      '-y','-v','error','-f','concat','-safe','0','-i',concatFile,
      '-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
      '-c:v','libx264','-preset','medium','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',
      join(dataRoot, relativeFile),
    ], { stdio:'inherit' });
    const writeDb = openStore();
    putItem(writeDb, { id, type:'film', parent:chapter.id, data:{ title:`${chapter.data.title} · 连续预演`, slug:`${chapter.data.slug}-preview`, file:relativeFile, duration:clips.length * 10, resolution:'1280x720', status:'candidate' } });
    for (const clip of clips) putLink(writeDb, { source:id, target:clip.id, kind:'derived_from' });
    writeDb.close();
    exportSnapshot();
    return id;
  } finally {
    rmSync(work, { recursive:true, force:true });
  }
}

async function generateVideo(selector) {
  const db = openStore();
  const shot = findItem(db, selector);
  if (shot.type !== 'shot') throw new Error(`${selector} is not a shot`);
  const model = flag('model', 'bytedance/doubao-seedance-2.0');
  const duration = Number(flag('duration', '10'));
  const resolution = flag('resolution', '720p');
  const refs = db.prepare(`
    SELECT latest.id, latest.data
    FROM link l
    JOIN item linked ON linked.id=l.target
    JOIN item latest ON substr(latest.id,1,32)=substr(linked.id,1,32)
    WHERE l.source=? AND l.kind='depends' AND latest.type='asset'
      AND latest.id=(SELECT max(candidate.id) FROM item candidate WHERE substr(candidate.id,1,32)=substr(linked.id,1,32))
  `).all(shot.id)
    .filter(row => !JSON.parse(row.data).copyright_sensitive)
    .sort((left, right) => Number(Boolean(JSON.parse(right.data).primary)) - Number(Boolean(JSON.parse(left.data).primary)));
  db.close();
  const content = [{ type: 'text', text: shot.data.body }];
  const images = [];
  for (const row of refs.slice(0, 3)) {
    const data = JSON.parse(row.data);
    if (!data.file || !/\.(png|jpe?g)$/i.test(data.file)) continue;
    const full = join(dataRoot, data.file);
    const mime = extname(full).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const base64 = readFileSync(full).toString('base64');
    images.push({ data, mime, base64 });
    content.push({ type: 'image_url', role: 'reference_image', image_url: { url: `data:${mime};base64,${base64}` } });
  }
  const key = process.env.ZENMUX_API_KEY;
  if (!key) throw new Error('ZENMUX_API_KEY is not set');
  const base = (process.env.ZENMUX_API_BASE_URL || 'https://zenmux.ai/api/v1').replace(/\/$/, '');
  const create = await fetch(`${base}/videos`, { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' }, body:JSON.stringify({ model, content, resolution, ratio:'16:9', duration, generate_audio:true, return_last_frame:true }) });
  const created = await create.json();
  let jobId;
  let resultBytes;
  let resultUrl;

  if (create.ok && created.id) {
    jobId = created.id;
    console.log(`submitted ${jobId}`);
    let job = created;
    for (let attempt = 0; !['succeeded','failed'].includes(job.status) && attempt < 80; attempt += 1) {
      await new Promise(resolveWait => setTimeout(resolveWait, 15000));
      const poll = await fetch(`${base}/videos/${jobId}`, { headers:{ Authorization:`Bearer ${key}` } });
      job = await poll.json();
      console.log(job.status || 'unknown');
    }
    if (job.status !== 'succeeded') throw new Error(JSON.stringify(job.error || job));
    resultUrl = job.content?.video_url;
  } else if (create.status === 404 && created.error?.type === 'model_not_supported') {
    const [provider, ...modelParts] = model.split('/');
    const modelName = modelParts.join('/');
    if (!provider || !modelName) throw new Error(`Vertex protocol needs provider/model, received: ${model}`);
    const vertexBase = (process.env.ZENMUX_VERTEX_API_BASE_URL || 'https://zenmux.ai/api/vertex-ai').replace(/\/$/, '');
    const endpoint = `${vertexBase}/v1/publishers/${provider}/models/${modelName}`;
    const firstFrame = images.find(image => String(image.data.slug || '').includes('keyframe')) || images.at(-1);
    const instance = { prompt: shot.data.body };
    if (firstFrame) instance.image = { bytesBase64Encoded:firstFrame.base64, mimeType:firstFrame.mime };
    const vertexCreate = await fetch(`${endpoint}:predictLongRunning`, {
      method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' },
      body:JSON.stringify({ instances:[instance], parameters:{ aspectRatio:'16:9', resolution, durationSeconds:duration, generateAudio:true, sampleCount:1 } }),
    });
    const operation = await vertexCreate.json();
    if (!vertexCreate.ok || !operation.name) throw new Error(JSON.stringify(operation));
    jobId = operation.name;
    console.log(`submitted ${jobId}`);
    let job = operation;
    for (let attempt = 0; !job.done && attempt < 80; attempt += 1) {
      await new Promise(resolveWait => setTimeout(resolveWait, 15000));
      const poll = await fetch(`${endpoint}:fetchPredictOperation`, {
        method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' },
        body:JSON.stringify({ operationName:jobId }),
      });
      job = await poll.json();
      console.log(job.done ? 'succeeded' : 'running');
    }
    if (!job.done || job.error) throw new Error(JSON.stringify(job.error || job));
    const video = job.response?.videos?.[0] || job.response?.generatedVideos?.[0]?.video || job.response?.generated_videos?.[0]?.video;
    resultBytes = video?.bytesBase64Encoded ? Buffer.from(video.bytesBase64Encoded, 'base64') : undefined;
    resultUrl = video?.gcsUri || video?.uri;
  } else {
    throw new Error(JSON.stringify(created));
  }

  if (!resultBytes && !resultUrl) throw new Error('Generation succeeded without video data');
  const id = makeId();
  const relativeFile = `assets/${id}.mp4`;
  if (resultBytes) writeFileSync(join(dataRoot, relativeFile), resultBytes);
  else {
    const output = await fetch(resultUrl);
    if (!output.ok) throw new Error(`Video download failed: ${output.status}`);
    writeFileSync(join(dataRoot, relativeFile), Buffer.from(await output.arrayBuffer()));
  }
  const writeDb = openStore();
  putItem(writeDb, { id, type:'clip', parent:shot.id, data:{ title:`${shot.data.title} · 候选成片`, slug:`${shot.data.slug}-candidate`, file:relativeFile, model, duration, resolution, status:'candidate', job:jobId } });
  putLink(writeDb, { source:id, target:shot.id, kind:'derived_from' });
  writeDb.close();
  exportSnapshot();
  console.log(id);
}

try {
  if (command === 'init') console.log(initialize());
  else if (command === 'import') console.log(importBundle(args[0]));
  else if (command === 'export') console.log(exportSnapshot());
  else if (command === 'list') {
    const db = openStore();
    const rows = args[0] ? db.prepare('SELECT id,type,data FROM item WHERE type=? ORDER BY rowid').all(args[0]) : db.prepare('SELECT id,type,data FROM item ORDER BY rowid').all();
    for (const row of rows) console.log(`${row.id}\t${row.type}\t${JSON.parse(row.data).title || ''}`);
    db.close();
  } else if (command === 'show') {
    const db = openStore(); console.log(JSON.stringify(findItem(db,args[0]),null,2)); db.close();
  } else if (command === 'prompt') {
    const db = openStore(); const item = findItem(db,args[0]); db.close();
    console.log(`请在 BookMontage 中处理 ${item.data.path || item.id}（ID: ${item.id}）。读取项目 Skill 和关联资产，保留人类草稿意图，完成后写回 SQLite、运行 bookmontage export 与 bookmontage verify，并将结果留给人类审核。`);
  } else if (command === 'prompt-search') {
    console.log(JSON.stringify(await seedancePromptSearch(args[0]?.startsWith('--') ? '' : args[0]), null, 2));
  } else if (command === 'prompt-facets') {
    console.log(JSON.stringify(await seedancePromptFacets(), null, 2));
  } else if (command === 'source-list') {
    console.log(JSON.stringify(sourceCatalogs, null, 2));
  } else if (command === 'source-search') {
    console.log(JSON.stringify(await searchSources(args[0]?.startsWith('--') ? '' : args[0], {
      source:flag('source', 'all'),
      model:flag('model', 'all'),
      category:flag('category', 'all'),
      sort:flag('sort', 'relevance'),
      limit:flag('limit', '6'),
      page:flag('page', '1'),
      atleast:flag('atleast', '1920x1080'),
      ratio:flag('ratio'),
      color:flag('color'),
      topRange:flag('top-range', '1M'),
      proxy:flag('proxy'),
      full:args.includes('--full'),
      refresh:args.includes('--refresh'),
    }), null, 2));
  } else if (command === 'revise') console.log(reviseItem(args[0],args[1]));
  else if (command === 'links') console.log(listItemLinks(args[0]));
  else if (command === 'relate') console.log(relationCommand('add',args[0],args[1],args[2]));
  else if (command === 'unlink') console.log(relationCommand('remove',args[0],args[1],args[2]));
  else if (command === 'stash') console.log(await stashRemote(args[0]));
  else if (command === 'verify') { const result=verifyStore(); console.log(JSON.stringify(result,null,2)); if(result.errors.length) process.exitCode=1; }
  else if (command === 'doctor') {
    const checks = [['ffmpeg','-version'],['ffprobe','-version'],['git','--version']].map(([tool,versionFlag]) => { try { execFileSync(tool,[versionFlag],{stdio:'ignore'}); return [tool,'ok']; } catch { return [tool,'missing']; } });
    checks.push(['ZENMUX_API_KEY',process.env.ZENMUX_API_KEY?'ok':'missing']);
    console.log(checks.map(row=>row.join('\t')).join('\n'));
  } else if (command === 'generate') await generateVideo(args[0]);
  else if (command === 'compose') console.log(composeChapter(args[0]));
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
