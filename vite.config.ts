import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();
process.env.DISABLE_HMR = 'true';

function preventDisconnectReloadPlugin(): Plugin {
  return {
    name: 'prevent-disconnect-reload',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
        return code.replaceAll('location.reload();', '/* reload disabled on idle timeout */');
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), preventDisconnectReloadPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      ws: process.env.DISABLE_HMR === 'true' ? (false as const) : undefined,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
