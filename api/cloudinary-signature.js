import { createHash } from 'node:crypto';
import { authorizeAdmin } from './admin-auth.js';
import { resolveCloudinaryServerConfig } from './cloudinary-config.js';

function reply(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim();
  try { return new URL(origin).host === host; } catch { return false; }
}

const safeFolder = value => String(value || 'portfolio-jessica')
  .trim()
  .replace(/[^a-zA-Z0-9/_-]+/g, '-')
  .replace(/\.{2,}|\/{2,}/g, '/')
  .replace(/^\/+|\/+$/g, '')
  .slice(0, 160) || 'portfolio-jessica';

const safePublicId = value => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .slice(0, 120);

const safeTags = value => (Array.isArray(value) ? value : [])
  .map(tag => String(tag).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40))
  .filter(Boolean)
  .slice(0, 20)
  .join(',');

export function createCloudinarySignature(parameters, apiSecret) {
  const payload = Object.keys(parameters)
    .sort()
    .filter(key => parameters[key] !== '' && parameters[key] !== undefined)
    .map(key => `${key}=${parameters[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`, 'utf8').digest('hex');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    reply(response, 405, { ok: false, error: 'Método não permitido.' });
    return;
  }
  if (!allowedOrigin(request)) {
    reply(response, 403, { ok: false, error: 'Origem não permitida.' });
    return;
  }

  const config = resolveCloudinaryServerConfig();
  if (!config.signedAvailable) {
    reply(response, 503, { ok: false, signedAvailable: false, error: 'Upload assinado não configurado; tentando preset unsigned.' });
    return;
  }

  const authorization = await authorizeAdmin(request);
  if (!authorization.ok) {
    reply(response, authorization.status, { ok: false, error: authorization.error });
    return;
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    folder: safeFolder(body.folder),
    timestamp
  };
  const publicId = safePublicId(body.publicId);
  const tags = safeTags(body.tags);
  if (publicId) parameters.public_id = publicId;
  if (tags) parameters.tags = tags;
  if (config.signedUploadPreset) parameters.upload_preset = config.signedUploadPreset;

  reply(response, 200, {
    ok: true,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature: createCloudinarySignature(parameters, config.apiSecret),
    parameters
  });
}
