#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { exportSnapshot } from '../lib/store.js';
import { saveInspirationDataUrl } from '../lib/inspirations.js';

const port = Number(process.env.BOOKMONTAGE_API_PORT || 3002);
const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

function send(response, status, value, origin = '') {
  response.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':localOrigin.test(origin) ? origin : 'http://localhost:3001',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Cache-Control':'no-store',
    Vary:'Origin',
  });
  response.end(JSON.stringify(value));
}

async function bodyOf(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 36 * 1024 * 1024) throw new Error('Request exceeds 36 MB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const origin = String(request.headers.origin || '');
  if (origin && !localOrigin.test(origin)) return send(response, 403, { error:'Local BookMontage only' });
  if (request.method === 'OPTIONS') return send(response, 204, {}, origin);
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { ok:true }, origin);
  if (request.method === 'GET' && request.url === '/api/library') {
    const snapshotFile = exportSnapshot();
    return send(response, 200, JSON.parse(readFileSync(snapshotFile, 'utf8')), origin);
  }
  if (request.method === 'POST' && request.url === '/api/inspirations') {
    try {
      const body = await bodyOf(request);
      const item = saveInspirationDataUrl({
        dataUrl:body.data_url,
        title:body.title,
        category:body.category,
        tags:Array.isArray(body.tags) ? body.tags : [],
      });
      const snapshotFile = exportSnapshot();
      return send(response, 201, { item, snapshot:JSON.parse(readFileSync(snapshotFile, 'utf8')) }, origin);
    } catch (error) {
      return send(response, 400, { error:error instanceof Error ? error.message : String(error) }, origin);
    }
  }
  return send(response, 404, { error:'Not found' }, origin);
});

server.listen(port, '127.0.0.1', () => console.log(`BookMontage local library API: http://127.0.0.1:${port}`));

for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
