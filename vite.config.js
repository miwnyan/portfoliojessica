import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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

/** Keep the requested clean /admin URL working in Vite dev and preview. */
function adminCleanUrl() {
  const rewriteAdmin = middlewares => {
    middlewares.use((request, _response, next) => {
      const [pathname, query = ''] = String(request.url || '').split('?');
      if (pathname === '/admin') {
        request.url = `/admin/${query ? `?${query}` : ''}`;
      }
      next();
    });
  };

  return {
    name: 'admin-clean-url',
    configureServer(server) {
      rewriteAdmin(server.middlewares);
    },
    configurePreviewServer(server) {
      rewriteAdmin(server.middlewares);
    }
  };
}

export default defineConfig({
  appType: 'mpa',
  base: '/',
  plugins: [adminCleanUrl(), copyStableAssets()],
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
});
