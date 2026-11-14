import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  classifyProspectOpportunity,
  discoverWebsiteSocials,
  searchPlacesTextProxy,
} from './src/api-handler.ts';

dotenv.config();
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // Dev server must always listen on port 3000 per platform constraints
  const PORT = 3000;

  app.use(express.json());

  // API route for AI prospect classification
  app.post('/api/classify-prospect', async (req, res) => {
    try {
      const result = await classifyProspectOpportunity(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in /api/classify-prospect:', error);
      res.status(500).json({
        error: 'Failed to classify prospect opportunity',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API route for discovering socials (Instagram, Facebook, etc.) from website or Google Search
  app.post('/api/discover-socials', async (req, res) => {
    try {
      const { url, businessName, city, state } = req.body;
      const result = await discoverWebsiteSocials(url, businessName, city, state);
      res.json(result);
    } catch (error) {
      console.error('Error in /api/discover-socials:', error);
      res.status(500).json({
        error: 'Failed to discover website socials',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API route for server-side Places API (New) text search fallback
  app.post('/api/places-search', async (req, res) => {
    try {
      const result = await searchPlacesTextProxy(req.body);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Error in /api/places-search:', error);
      res.status(500).json({
        ok: false,
        status: 500,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Initialize Vite asynchronously so port 3000 binds immediately on cold boot
    const viteReady = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          ws: false,
          watch: null,
        },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await viteReady;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReplyNation Prospect Finder server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
