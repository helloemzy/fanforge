import app from '../src/app.js';
import { httpServerHandler } from 'cloudflare:node';

if (!globalThis.__fanforgeExpressServerStarted) {
  app.listen(3000);
  globalThis.__fanforgeExpressServerStarted = true;
}

export default httpServerHandler({
  port: 3000,
});
