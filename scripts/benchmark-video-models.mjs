#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { dataRoot, exportSnapshot, findItem, makeId, openStore, putItem, putLink } from '../lib/store.js';

const models = [
  ['minimax/minimax-h3', 'MiniMax H3'],
  ['bytedance/doubao-seedance-2.0', 'Seedance 2.0'],
];

const prompt = `5秒、16:9、唯美东方幻想 CG、连贯单镜头。<Picture 1>只负责白衣女剑士的脸、短发、服装和身材；<Picture 2>只负责黑衣女剑士的脸、长发、服装和身材；<Picture 3>只负责月蚀花园、水面石台与冷金色月光。0–1秒，两人相隔八米对峙。1–2秒，白衣女剑士突然瞬移八米到黑衣女剑士右后方，身体沿清晰可见的完整路径高速掠过，白金羽流拖尾。2–3.5秒，白衣女剑士挥出一记带白金法力的横向掌击；黑衣女剑士立即转身，用双臂展开直径两米的半透明玄黑圆盾，掌击必须在盾面产生一次清晰接触、压缩与爆炸。3.5–5秒，黑衣女剑士连人带盾被冲击波水平击退六米，双脚划过浅水形成两道连续水痕，白衣女剑士顺势追击半步，镜头高速横移跟拍后停在双人中景。两人外观必须分别服从自己的角色图，不能换脸、换装、融合或增减人物。无对白；若模型支持音频，只生成瞬移破风、盾面重击、低频冲击和水花声。禁止慢动作、原地互推、普通拳脚、肢体粘连、忽然切镜、文字、字幕、标志和水印。`;
const key = process.env.ZENMUX_API_KEY;
if (!key) throw new Error('ZENMUX_API_KEY is not set');
const base = (process.env.ZENMUX_API_BASE_URL || 'https://zenmux.ai/api/v1').replace(/\/$/, '');

function imageInput(item) {
  const full = join(dataRoot, String(item.data.file));
  const mime = extname(full).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return { mime, base64: readFileSync(full).toString('base64') };
}

async function generate(model, title, book, references) {
  const resolution = model === 'minimax/minimax-h3' ? '768p' : '720p';
  const images = references.map(imageInput);
  const requestImages = images;
  const body = {
    model,
    content: [{ type: 'text', text: prompt }, ...requestImages.map(image => ({
      type: 'image_url', role: 'reference_image', image_url: { url: `data:${image.mime};base64,${image.base64}` },
    }))],
    resolution,
    ratio: '16:9',
    duration: 5,
    generate_audio: true,
  };
  const create = await fetch(`${base}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const created = await create.json();
  let jobId;
  let resultUrl;
  let resultBytes;
  if (create.ok && created.id) {
    jobId = created.id;
    console.log(`${title}\tsubmitted\t${jobId}`);
    let job = created;
    for (let attempt = 0; !['succeeded', 'failed'].includes(job.status) && attempt < 100; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      const poll = await fetch(`${base}/videos/${jobId}`, { headers: { Authorization: `Bearer ${key}` } });
      job = await poll.json();
      console.log(`${title}\t${job.status || 'unknown'}\t${jobId}`);
    }
    if (job.status !== 'succeeded' || !job.content?.video_url) throw new Error(`${model}: ${JSON.stringify(job.error || job)}`);
    resultUrl = job.content.video_url;
  } else if (create.status === 404 && created.error?.type === 'model_not_supported') {
    const [provider, ...modelParts] = model.split('/');
    const modelName = modelParts.join('/');
    const vertexPrompt = prompt;
    const parameters = { aspectRatio: '16:9', resolution, durationSeconds: 5, generateAudio: true, sampleCount: 1 };
    const instance = {
      prompt: vertexPrompt,
      referenceImages: requestImages.map(image => ({
        image: { bytesBase64Encoded: image.base64, mimeType: image.mime }, referenceType: 'asset',
      })),
    };
    const vertexBase = (process.env.ZENMUX_VERTEX_API_BASE_URL || 'https://zenmux.ai/api/vertex-ai').replace(/\/$/, '');
    const endpoint = `${vertexBase}/v1/publishers/${provider}/models/${modelName}`;
    const vertexCreate = await fetch(`${endpoint}:predictLongRunning`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [instance],
        parameters,
      }),
    });
    const operation = await vertexCreate.json();
    if (!vertexCreate.ok || !operation.name) throw new Error(`${model}: ${JSON.stringify(operation)}`);
    jobId = operation.name;
    console.log(`${title}\tsubmitted-vertex\t${jobId}`);
    let job = operation;
    for (let attempt = 0; !job.done && attempt < 100; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      const poll = await fetch(`${endpoint}:fetchPredictOperation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName: jobId }),
      });
      job = await poll.json();
      console.log(`${title}\t${job.done ? 'succeeded' : 'running'}\t${jobId}`);
    }
    if (!job.done || job.error) throw new Error(`${model}: ${JSON.stringify(job.error || job)}`);
    const video = job.response?.videos?.[0] || job.response?.generatedVideos?.[0]?.video || job.response?.generated_videos?.[0]?.video;
    if (video?.bytesBase64Encoded) resultBytes = Buffer.from(video.bytesBase64Encoded, 'base64');
    resultUrl = video?.gcsUri || video?.uri;
  } else {
    throw new Error(`${model}: ${JSON.stringify(created)}`);
  }
  if (!resultBytes && !resultUrl) throw new Error(`${model}: generation returned no video`);
  const id = makeId();
  const filename = `${id}.mp4`;
  if (resultBytes) writeFileSync(join(dataRoot, 'tmp', filename), resultBytes);
  else {
    const response = await fetch(resultUrl);
    if (!response.ok) throw new Error(`${model}: download HTTP ${response.status}`);
    writeFileSync(join(dataRoot, 'tmp', filename), Buffer.from(await response.arrayBuffer()));
  }
  const db = openStore();
  putItem(db, { id, type: 'temp_asset', parent: book.id, data: {
    title: `模型试片 · ${title} · 5秒`,
    slug: `benchmark-${model.replaceAll('/', '-')}`,
    file: `tmp/${filename}`,
    mime: 'video/mp4',
    media_type: 'video',
    model,
    duration: 5,
    resolution,
    note: `同一提示词、同三张参考图、${resolution}、有声；任务 ${jobId}`,
    prompt,
  } });
  for (const reference of references) putLink(db, { source: id, target: reference.id, kind: 'derived_from' });
  db.close();
  exportSnapshot();
  console.log(`${title}\tsaved\t${id}`);
  return id;
}

const db = openStore();
const book = findItem(db, 'beyond-wandering-mountain');
const references = [findItem(db, 'benchmark-aurelia'), findItem(db, 'benchmark-jinlan'), findItem(db, 'benchmark-eclipse-garden')];
db.close();

const selected = process.argv.slice(2);
const targets = selected.length ? models.filter(([model]) => selected.includes(model)) : models;
await Promise.all(targets.map(async ([model, title]) => {
  try {
    await generate(model, title, book, references);
  } catch (error) {
    console.error(`${title}\tfailed\t${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}));
