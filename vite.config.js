import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Runs the /api serverless functions inside `npm run dev`, so payments work
// locally in VS Code without installing the Vercel CLI. On Vercel, the same
// files in /api are deployed as real serverless functions.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const name = req.url.slice(5).split('?')[0];
        // Only endpoint names (e.g. /api/create-order). Module files such as
        // /api/_catalog.js are imported by the browser and must pass through.
        if (!/^[a-z-]+$/.test(name)) return next();
        const file = path.resolve(process.cwd(), 'api', `${name}.js`);
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Not found' }));
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return { plugins: [react(), localApi()] };
});
