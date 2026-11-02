import { run } from './run.mjs';
for (const directory of ['api', 'web']) await run(['--prefix', directory, 'run', 'build']);
