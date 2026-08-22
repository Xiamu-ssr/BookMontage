#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { dataRoot, exportSnapshot, findItem, importBundle, initialize, logicalId, makeId, openStore, putItem, putLink, reviseItem, verifyStore } from '../lib/store.js';

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
  bookmontage revise <id> <patch.json>
  bookmontage verify
  bookmontage doctor
  bookmontage generate <shot-id> [--model sapiens-ai/agnes-video-v2.0] [--duration 10] [--resolution 720p]
  bookmontage compose <chapter-id>
`);
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
  const model = flag('model', 'sapiens-ai/agnes-video-v2.0');
  const duration = Number(flag('duration', '10'));
  const resolution = flag('resolution', '720p');
  const refs = db.prepare(`SELECT i.id, i.data FROM link l JOIN item i ON i.id=l.target WHERE l.source=? AND l.kind='depends' AND i.type='asset'`).all(shot.id);
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
  } else if (command === 'revise') console.log(reviseItem(args[0],args[1]));
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
