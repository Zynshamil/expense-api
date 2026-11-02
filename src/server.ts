import { configuration } from './config.js';
import { openDatabase } from './database.js';
import { migrate } from './migrate.js';
import { createApp } from './app.js';
const config = configuration();
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('API_PORT must be a valid port.');
if (!config.production && !['localhost', '127.0.0.1', '::1'].includes(config.host)) throw new Error('Development auto-login is restricted to a loopback API_HOST.');
const store = openDatabase(config);
await migrate(store);
const server = createApp(config, store).listen(config.port, config.host, () => {
  console.log(`Express API ready: http://${config.host}:${config.port}/api/health`);
  console.log(`Database: ${config.databaseDriver === 'sqlite' ? config.databasePath : 'Cloudflare D1 (remote)'}`);
  if (!config.production) console.log('Local development account enabled. Production requires an owner password and session secret.');
});
server.on('error', error => { console.error(error.message); store.close(); process.exit(1); });
const shutdown = () => { server.close(() => { store.close(); process.exit(0); }); server.closeIdleConnections(); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
