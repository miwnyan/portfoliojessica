import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import chatHandler from './api/chat.js';
import contactHandler from './api/contact.js';
import adminChatHandler from './api/admin-chat.js';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

const PRIVATE_RUNTIME_KEYS = [
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'FIREBASE_API_KEY',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'CONTACT_EMAIL',
  'SMTP_FROM_NAME',
  'DISCORD_WEBHOOK_URL',
  'DISCORD_CONTACT_USER_ID'
];

function exposePrivateRuntimeEnvironment(environment) {
  for (const key of PRIVATE_RUNTIME_KEYS) {
    if (!process.env[key] && environment[key]) process.env[key] = environment[key];
  }
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      raw += chunk;
      if (raw.length > 64 * 1024) rejectBody(new Error('PAYLOAD_TOO_LARGE'));
    });
    request.on('end', () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        rejectBody(new Error('INVALID_JSON'));
      }
    });
    request.on('error', rejectBody);
  });
}

function adaptResponse(response) {
  const adapter = {
    status(code) {
      response.statusCode = code;
      return adapter;
    },
    setHeader(name, value) {
      response.setHeader(name, value);
      return adapter;
    },
    end(value) {
      response.end(value);
    }
  };
  return adapter;
}

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
  exposePrivateRuntimeEnvironment(environment);
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
    middlewares.use(async (request, response, next) => {
      const [pathname, query = ''] = String(request.url || '').split('?');
      const apiHandler = pathname === '/api/chat'
        ? chatHandler
        : pathname === '/api/admin-chat'
          ? adminChatHandler
          : pathname === '/api/contact'
            ? contactHandler
            : null;
      if (apiHandler) {
        try {
          if (request.method === 'POST') request.body = await readJsonBody(request);
          await apiHandler(request, adaptResponse(response));
        } catch (error) {
          response.statusCode = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ ok: false, error: 'Conteúdo inválido.' }));
        }
        return;
      }
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
