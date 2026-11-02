import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, npm } from './run.mjs';
for (const path of [join(root, 'api', '.env'), join(root, '.env')]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
const production = process.argv.includes('--production');
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
for (const directory of ['api', 'web']) {
  const child = npm(['--prefix', directory, 'run', production ? 'start' : 'dev'], {
    env: { ...process.env, NODE_ENV: production ? 'production' : 'development' },
  });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!closing) stop(code || 0); });
}
console.log('\nPenny starts two independent services:');
console.log('  Frontend: http://localhost:5173/');
console.log('  Express API: http://127.0.0.1:3001/api/health');
console.log('  Press Ctrl+C to stop both.\n');
