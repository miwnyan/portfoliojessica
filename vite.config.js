import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Some default portfolio records refer to files by their stable /assets path.
 * Keep that directory intact in addition to Vite's optimized build assets.
 */
function copyStableAssets() {
  return {
    name: 'copy-stable-assets',
    apply: 'build',
    writeBundle(outputOptions) {
      const source = resolve(rootDirectory, 'assets');
      const outputDirectory = outputOptions.dir || resolve(rootDirectory, 'dist');

      if (existsSync(source)) {
        cpSync(source, resolve(outputDirectory, 'assets'), {
          recursive: true,
          force: true
        });
      }
    }
  };
}

/** Keep local app routes working in Vite dev and preview. */
function localAppRoutes(mode) {
  const environment = loadEnv(mode, rootDirectory, '');
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    || process.env.VITE_CLOUDINARY_CLOUD_NAME
    || environment.CLOUDINARY_CLOUD_NAME
    || environment.VITE_CLOUDINARY_CLOUD_NAME
    || '';
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET
    || process.env.VITE_CLOUDINARY_UPLOAD_PRESET
    || environment.CLOUDINARY_UPLOAD_PRESET
    || environment.VITE_CLOUDINARY_UPLOAD_PRESET
    || '';
  const rewriteAdmin = middlewares => {
    middlewares.use((request, response, next) => {
      const [pathname, query = ''] = String(request.url || '').split('?');
      if (pathname === '/api/public-config') {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET');
          response.end(JSON.stringify({ error: 'Método não permitido.' }));
          return;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({
          cloudinary: {
            configured: Boolean(cloudName && uploadPreset),
            cloudName,
            uploadPreset
          }
        }));
        return;
      }
      if (pathname === '/admin') {
        request.url = `/admin/${query ? `?${query}` : ''}`;
      }
      next();
    });
  };

  return {
    name: 'local-app-routes',
    configureServer(server) {
      rewriteAdmin(server.middlewares);
    },
    configurePreviewServer(server) {
      rewriteAdmin(server.middlewares);
    }
  };
}

export default defineConfig(({ mode }) => ({
  appType: 'mpa',
  base: '/',
  plugins: [localAppRoutes(mode), copyStableAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        portfolio: resolve(rootDirectory, 'index.html'),
        admin: resolve(rootDirectory, 'admin/index.html')
      }
    }
  }
}));
