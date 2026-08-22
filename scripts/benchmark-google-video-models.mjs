#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allItems, dataRoot, exportSnapshot, findItem, makeId, openStore, putItem, putLink, projectRoot } from '../lib/store.js';

const key = process.env.ZENMUX_API_KEY;
if (!key) throw new Error('ZENMUX_API_KEY is not set');

const sourceFrame = '/Users/xiamu/Documents/AIvideo/eclipse-duel/assets/storyboards/duel-opening-keyframe-v2.png';
if (!existsSync(sourceFrame)) throw new Error(`Missing benchmark frame: ${sourceFrame}`);

const omniPrompt = `[# Sources <FIRST_FRAME>@Image1]
Exactly five seconds, 16:9. In a single unbroken scene. In a single continuous shot. No scene cuts.
[0-1s] Start exactly from <FIRST_FRAME>. Preserve the identities, faces, costumes, body proportions, moonlit wet garden, and spatial layout of both adult women.
[1-2s] The white-clad fighter in the background explosively dashes eight meters along one clearly visible path to the black-clad fighter's right rear, leaving a white-gold feather trail. The camera performs one fast lateral tracking move without cutting.
[2-3.5s] She delivers one sweeping white-gold palm strike. The black-clad fighter pivots and expands a two-meter translucent black circular energy shield. Show one unmistakable palm-to-shield contact, compression, then a sharp energy burst.
[3.5-5s] The impact pushes the black-clad fighter and shield six meters sideways; both boots carve two continuous wakes through the shallow water while the white-clad fighter follows one step. End on a stable two-person medium shot.
Sound design: fast wind shear, one heavy magical shield impact, low-frequency shockwave, continuous water spray. No dialogue. No extra people, identity swaps, costume changes, merged bodies, slow motion, text, subtitles, logos, or watermarks. Use Image1 as the starting frame.`;

const veoPrompt = `Cinematography: A single continuous five-second 16:9 low-angle lateral tracking shot, beginning from the supplied first frame. Fast camera acceleration during the dash, crisp readable impact, then settle into a stable two-person medium shot. No cuts and no slow motion.

Subject: Preserve the exact identities, faces, costumes, body proportions, and positions of the two adult female fantasy fighters in the input image: the white-clad fighter in the background and the black-clad fighter crouched in the foreground.

Action: During the first second they hold their starting poses. From 1 to 2 seconds, the white-clad fighter explosively dashes eight meters along a visible white-gold feather trail to the black-clad fighter's right rear. From 2 to 3.5 seconds, she delivers one sweeping palm strike as the black-clad fighter pivots and opens a two-meter translucent black circular energy shield. Show a single clear hand-to-shield contact, shield compression, and a sharp energy burst. From 3.5 to 5 seconds, the black-clad fighter and shield are driven six meters sideways; both boots carve two continuous wakes through shallow water while the white-clad fighter follows one step.

Context: The same moonlit wet fantasy garden shown in the input image, with reflective shallow water and pale stone, preserved throughout.

Style and ambiance: Elegant high-end oriental fantasy CG, cold moonlight, restrained white-gold and ink-black magic, physically readable motion, sharp impact timing.

Audio: Fast wind shear for the dash, one heavy magical shield impact, a low-frequency shockwave, and continuous water spray. No dialogue.`;

const veoNegative = 'extra people, identity swap, costume change, merged bodies, deformed hands, body intersection, standing still, tiny motion, repeated punches, scene cuts, slow motion, text, subtitles, logo, watermark';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const resultFile = join(projectRoot, 'work', 'google-video-benchmark-result.json');

function ensureInputAsset() {
  const db = openStore();
  const existing = allItems(db).find(item => item.type === 'temp_asset' && item.data.slug === 'benchmark-duel-opening-first-frame');
  if (existing) { db.close(); return existing; }
  const book = findItem(db, 'beyond-wandering-mountain');
  const id = makeId();
  const filename = `${id}.png`;
  copyFileSync(sourceFrame, join(dataRoot, 'tmp', filename));
  const item = { id, type: 'temp_asset', parent: book.id, data: {
    title: '模型试片输入 · 双人对峙首帧',
    slug: 'benchmark-duel-opening-first-frame',
    file: `tmp/${filename}`,
    mime: 'image/png',
    media_type: 'image',
    note: '原创角色与原创场景合成首帧；Gemini Omni Flash 与 Veo 3.1 共用视觉输入。',
  } };
  putItem(db, item);
  db.close();
  exportSnapshot();
  return item;
}

function findVideoPart(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.data && (value.type === 'video' || String(value.mime_type || value.mimeType || '').startsWith('video/'))) return { data:value.data, mime:value.mime_type || value.mimeType || 'video/mp4' };
  if (value.bytesBase64Encoded) return { data:value.bytesBase64Encoded, mime:value.mimeType || 'video/mp4' };
  for (const child of Object.values(value)) {
    if (typeof child === 'object') { const found = findVideoPart(child); if (found) return found; }
  }
  return null;
}

function saveVideo({ title, slug, model, prompt, resolution, duration, taskId, bytes, input }) {
  const db = openStore();
  const book = findItem(db, 'beyond-wandering-mountain');
  const id = makeId();
  const filename = `${id}.mp4`;
  writeFileSync(join(dataRoot, 'tmp', filename), bytes);
  putItem(db, { id, type: 'temp_asset', parent: book.id, data: {
    title, slug, file:`tmp/${filename}`, mime:'video/mp4', media_type:'video', model,
    duration, resolution, prompt, note:`有声图生视频；任务 ${taskId}`,
  } });
  putLink(db, { source:id, target:input.id, kind:'derived_from' });
  db.close();
  exportSnapshot();
  return { id, file:join(dataRoot, 'tmp', filename), taskId, model, resolution, duration };
}

async function generateOmni(input, imageBase64) {
  const model = 'google/gemini-omni-flash-preview';
  console.log(`Gemini Omni Flash\tsubmitting\t${model}`);
  const response = await fetch('https://zenmux.ai/api/v1/interactions', {
    method:'POST', headers,
    body:JSON.stringify({
      model,
      input:[
        { type:'image', data:imageBase64, mime_type:'image/png' },
        { type:'text', text:omniPrompt },
      ],
      generation_config:{ video_config:{ task:'image_to_video' } },
      response_format:{ type:'video', aspect_ratio:'16:9' },
      stream:false,
      background:false,
      store:false,
    }),
  });
  const body = await response.json();
  if (!response.ok || body.status === 'failed') throw new Error(`Gemini Omni HTTP ${response.status}: ${JSON.stringify(body.error || body).slice(0, 2000)}`);
  const video = findVideoPart(body.output_video) || findVideoPart(body.steps);
  if (!video?.data) throw new Error(`Gemini Omni returned no inline video: ${JSON.stringify({ id:body.id, status:body.status, keys:Object.keys(body) })}`);
  const saved = saveVideo({ title:'模型试片 · Gemini Omni Flash · 5秒', slug:'benchmark-google-gemini-omni-flash-preview', model, prompt:omniPrompt, resolution:'720p', duration:5, taskId:body.id, bytes:Buffer.from(video.data, 'base64'), input });
  console.log(`Gemini Omni Flash\tsaved\t${saved.file}`);
  return { ...saved, usage:body.usage || null };
}

async function generateVeo(input, imageBase64) {
  const model = 'google/veo-3.1-generate-001';
  const endpoint = 'https://zenmux.ai/api/vertex-ai/v1/publishers/google/models/veo-3.1-generate-001';
  console.log(`Veo 3.1\tsubmitting\t${model}`);
  const response = await fetch(`${endpoint}:predictLongRunning`, {
    method:'POST', headers,
    body:JSON.stringify({
      instances:[{ prompt:veoPrompt, image:{ bytesBase64Encoded:imageBase64, mimeType:'image/png' } }],
      parameters:{
        aspectRatio:'16:9', resolution:'720p', durationSeconds:5, generateAudio:true,
        negativePrompt:veoNegative, enhancePrompt:true, personGeneration:'allow_adult', sampleCount:1,
      },
    }),
  });
  let operation = await response.json();
  if (!response.ok || !operation.name) throw new Error(`Veo HTTP ${response.status}: ${JSON.stringify(operation).slice(0, 2000)}`);
  console.log(`Veo 3.1\tsubmitted\t${operation.name}`);
  for (let attempt = 0; !operation.done && attempt < 40; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 15000));
    const poll = await fetch(`${endpoint}:fetchPredictOperation`, { method:'POST', headers, body:JSON.stringify({ operationName:operation.name }) });
    operation = await poll.json();
    if (!poll.ok) throw new Error(`Veo poll HTTP ${poll.status}: ${JSON.stringify(operation).slice(0, 2000)}`);
    console.log(`Veo 3.1\t${operation.done ? 'completed' : 'running'}\t${operation.name || 'operation'}`);
  }
  if (!operation.done || operation.error) throw new Error(`Veo failed: ${JSON.stringify(operation.error || operation).slice(0, 2000)}`);
  const video = findVideoPart(operation.response?.videos) || findVideoPart(operation.response?.generatedVideos);
  if (!video?.data) throw new Error(`Veo returned no inline video: ${JSON.stringify({ name:operation.name, keys:Object.keys(operation.response || {}) })}`);
  const saved = saveVideo({ title:'模型试片 · Veo 3.1 · 5秒', slug:'benchmark-google-veo-3.1-generate-001', model, prompt:veoPrompt, resolution:'720p', duration:5, taskId:operation.name, bytes:Buffer.from(video.data, 'base64'), input });
  console.log(`Veo 3.1\tsaved\t${saved.file}`);
  return saved;
}

const input = ensureInputAsset();
const imageBase64 = readFileSync(join(dataRoot, String(input.data.file))).toString('base64');
const jobs = [
  ['gemini', () => generateOmni(input, imageBase64)],
  ['veo', () => generateVeo(input, imageBase64)],
];
const results = {};
await Promise.all(jobs.map(async ([name, generate]) => {
  try { results[name] = { ok:true, value:await generate() }; }
  catch (error) { results[name] = { ok:false, error:error instanceof Error ? error.message : String(error) }; console.error(`${name}\tfailed\t${results[name].error}`); }
}));
writeFileSync(resultFile, `${JSON.stringify(results, null, 2)}\n`);
if (Object.values(results).some(result => !result.ok)) process.exitCode = 1;
