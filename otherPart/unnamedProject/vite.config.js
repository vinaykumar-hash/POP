import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { handleApiRequest } from './src/backend/apiRouter.js';

/**
 * Vite plugin mounting the AWS Lambda API router into Vite's local dev server
 */
function backendApiPlugin() {
  return {
    name: 'parksync-backend-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const path = urlObj.pathname + urlObj.search;
        const method = req.method;

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          let body = {};
          if (rawBody && rawBody.trim()) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = {};
            }
          }

          const response = await handleApiRequest(method, path, req.headers, body);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(response.body));
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), backendApiPlugin()],
});
