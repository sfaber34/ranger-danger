import { defineConfig } from 'vite';
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_PATH = resolve(process.cwd(), 'debug.log');

export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'es2020' },
  plugins: [
    {
      name: 'debug-log-sink',
      configureServer(server) {
        // Run after Vite's internal middlewares so POSTs aren't swallowed
        // by the SPA HTML fallback.
        return () => {
          server.middlewares.use('/debug-log', (req, res) => {
            if (req.method === 'DELETE') {
              writeFileSync(LOG_PATH, '');
              res.statusCode = 204;
              res.end();
              return;
            }
            if (req.method === 'GET') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/plain');
              res.end(`debug-log endpoint OK. Writing to ${LOG_PATH}\n`);
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end();
              return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                appendFileSync(LOG_PATH, body + '\n');
                res.statusCode = 204;
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[debug-log] write failed:', err);
                res.statusCode = 500;
              }
              res.end();
            });
          });
          // eslint-disable-next-line no-console
          console.log(`[debug-log] endpoint registered, writing to ${LOG_PATH}`);
        };
      },
    },
  ],
});
