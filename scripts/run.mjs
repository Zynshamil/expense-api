import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const npmCli = process.env.npm_execpath;
export function npm(args, options = {}) {
  if (npmCli) return spawn(process.execPath, [npmCli, ...args], { cwd: root, stdio: 'inherit', ...options });
  return spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...options });
}
export function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = npm(args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed (${signal || code})`)));
  });
}
