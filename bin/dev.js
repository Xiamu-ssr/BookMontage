#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { projectRoot } from '../lib/store.js';

const children = [
  spawn(process.execPath, [join(projectRoot, 'bin', 'inspiration-api.js')], { stdio:'inherit', env:process.env }),
  spawn(join(projectRoot, 'node_modules', '.bin', 'vinext'), ['dev', ...process.argv.slice(2)], { stdio:'inherit', env:process.env }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop(0));
