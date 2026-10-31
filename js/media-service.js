const env = import.meta.env || {};
const MEBIBYTE = 1024 * 1024;
const configuredLimit = Number.parseFloat(String(env.VITE_MAX_UPLOAD_MB || '10'));
const limitInMegabytes = Number.isFinite(configuredLimit) && configuredLimit > 0
  ? configuredLimit
  : 10;
const limitLabel = Number.isInteger(limitInMegabytes)
  ? String(limitInMegabytes)
  : limitInMegabytes.toFixed(1).replace(/\.0$/, '');

export const MAX_UPLOAD_BYTES = Math.floor(limitInMegabytes * MEBIBYTE);

export const ALLOWED_MEDIA_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico'
]);

const buildCloudName = String(env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
const buildUploadPreset = String(env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
let runtimeConfigPromise;

export class MediaUploadError extends Error {
  constructor(message, code = 'media/upload-failed', details = null) {
    super(message);
    this.name = 'MediaUploadError';
    this.code = code;
    this.details = details;
  }
}

const fileExtension = fileName => {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
};

export function validateMediaFile(file) {
  if (!file || typeof file !== 'object') {
    return {
      valid: false,
      error: 'Selecione uma imagem para enviar.',
      code: 'media/file-required',
      maxBytes: MAX_UPLOAD_BYTES
    };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    return {
      valid: false,
      error: 'O arquivo selecionado está vazio ou é inválido.',
      code: 'media/invalid-file',
      maxBytes: MAX_UPLOAD_BYTES
    };
  }

  if (size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `A imagem excede o limite de ${limitLabel} MiB.`,
      code: 'media/file-too-large',
      maxBytes: MAX_UPLOAD_BYTES
    };
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = fileExtension(file.name);
  const supportedMime = ALLOWED_MEDIA_TYPES.includes(mimeType);
  const supportedExtension = ALLOWED_EXTENSIONS.has(extension);

  if (!supportedMime || !supportedExtension) {
    return {
      valid: false,
      error: 'Use JPG, PNG, GIF, WebP, AVIF, SVG ou ICO.',
      code: 'media/unsupported-format',
      maxBytes: MAX_UPLOAD_BYTES
    };
  }

  return {
    valid: true,
    error: '',
    code: '',
    maxBytes: MAX_UPLOAD_BYTES,
    bytes: size,
    mimeType,
    extension
  };
}

const safeFolder = value => String(value || 'portfolio')
  .trim()
  .replace(/[^a-zA-Z0-9/_-]+/g, '-')
  .replace(/\.{2,}|\/{2,}/g, '/')
  .replace(/^\/+|\/+$/g, '')
  .slice(0, 160) || 'portfolio';

function normalizeOptions(options) {
  if (typeof options === 'function') return { onProgress: options };
  if (typeof options === 'string') return { folder: `portfolio/${safeFolder(options)}` };
  return options && typeof options === 'object' ? options : {};
}

function cloudinaryError(response, status, headerMessage = '') {
  const message = response?.error?.message || response?.message || headerMessage;
  return new MediaUploadError(
    message ? `Cloudinary recusou o envio: ${message}` : 'Não foi possível enviar a imagem ao Cloudinary.',
    status === 413 ? 'media/file-too-large' : 'media/cloudinary-error',
    { status, providerMessage: String(message || '') }
  );
}

const validUnsignedConfig = config => /^[a-zA-Z0-9_-]+$/.test(config.cloudName)
  && /^[a-zA-Z0-9_-]+$/.test(config.uploadPreset);

async function resolveCloudinaryConfig() {
  const buildConfig = { cloudName: buildCloudName, uploadPreset: buildUploadPreset };
  if (validUnsignedConfig(buildConfig)) return buildConfig;

  runtimeConfigPromise ??= fetch('/api/public-config', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin'
  }).then(async response => {
    if (!response.ok) return buildConfig;
    const payload = await response.json().catch(() => ({}));
    return {
      cloudName: String(payload.cloudinary?.cloudName || '').trim(),
      uploadPreset: String(payload.cloudinary?.uploadPreset || '').trim()
    };
  }).catch(() => buildConfig);

  return runtimeConfigPromise;
}

async function requestSignedUpload(options, metadata) {
  const authToken = String(options.authToken || '').trim();
  if (!authToken) return null;

  let response;
  try {
    response = await fetch('/api/cloudinary-signature', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify({
        folder: metadata.folder,
        publicId: metadata.publicId,
        tags: metadata.tags
      })
    });
  } catch {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if ([404, 405, 503].includes(response.status) && payload.signedAvailable !== true) return null;
  if (!response.ok) {
    throw new MediaUploadError(
      payload.error || 'Não foi possível autorizar o upload da imagem.',
      response.status === 401 || response.status === 403 ? 'media/not-authorized' : 'media/signature-failed',
      { status: response.status }
    );
  }

  const cloudName = String(payload.cloudName || '').trim();
  const apiKey = String(payload.apiKey || '').trim();
  const signature = String(payload.signature || '').trim();
  const parameters = payload.parameters && typeof payload.parameters === 'object'
    ? payload.parameters
    : {};
  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !/^[a-f0-9]{40}$/i.test(signature) || !parameters.timestamp) {
    throw new MediaUploadError('O servidor retornou uma autorização de upload inválida.', 'media/invalid-signature');
  }
  return { cloudName, apiKey, signature, parameters };
}

/**
 * Envia diretamente ao Cloudinary. Quando o servidor possui credenciais
 * privadas, usa uma assinatura temporária emitida apenas para a conta admin;
 * caso contrário, usa o preset unsigned público configurado.
 */
export async function uploadMedia(file, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const validation = validateMediaFile(file);

  if (!validation.valid) {
    throw new MediaUploadError(validation.error, validation.code, validation);
  }
  if (options.signal?.aborted) {
    throw new MediaUploadError('Envio cancelado.', 'media/aborted');
  }

  const metadata = {
    folder: safeFolder(options.folder),
    publicId: options.publicId
      ? String(options.publicId).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120)
      : '',
    tags: Array.isArray(options.tags)
      ? options.tags
        .map(tag => String(tag).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40))
        .filter(Boolean)
        .slice(0, 20)
      : []
  };
  const signedUpload = await requestSignedUpload(options, metadata);
  let cloudName = signedUpload?.cloudName || '';
  let uploadPreset = '';
  if (!signedUpload) {
    const unsignedConfig = await resolveCloudinaryConfig();
    cloudName = unsignedConfig.cloudName;
    uploadPreset = unsignedConfig.uploadPreset;
    if (!validUnsignedConfig(unsignedConfig)) {
      throw new MediaUploadError(
        'O upload de imagens está indisponível. Configure credenciais assinadas ou um preset unsigned no ambiente da publicação.',
        'media/not-configured'
      );
    }
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    let settled = false;

    const finish = callback => value => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abortUpload);
      callback(value);
    };
    const succeed = finish(resolve);
    const fail = finish(reject);
    const abortUpload = () => request.abort();

    formData.append('file', file);
    if (signedUpload) {
      Object.entries(signedUpload.parameters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) formData.append(key, String(value));
      });
      formData.append('api_key', signedUpload.apiKey);
      formData.append('signature', signedUpload.signature);
    } else {
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', metadata.folder);
      if (metadata.publicId) formData.append('public_id', metadata.publicId);
      if (metadata.tags.length) formData.append('tags', metadata.tags.join(','));
    }

    request.open('POST', endpoint, true);
    request.responseType = 'json';
    request.timeout = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 120_000;

    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable || typeof options.onProgress !== 'function') return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      options.onProgress(percent, event.loaded, event.total);
    });

    request.addEventListener('load', () => {
      const response = request.response;
      if (request.status < 200 || request.status >= 300 || !response?.secure_url) {
        fail(cloudinaryError(response, request.status, request.getResponseHeader('X-Cld-Error')));
        return;
      }
      if (typeof options.onProgress === 'function') {
        options.onProgress(100, validation.bytes, validation.bytes);
      }
      succeed({
        url: String(response.secure_url),
        secureUrl: String(response.secure_url),
        publicId: String(response.public_id || ''),
        width: Number(response.width) || null,
        height: Number(response.height) || null,
        bytes: Number(response.bytes) || validation.bytes,
        format: String(response.format || validation.extension),
        resourceType: String(response.resource_type || 'image'),
        originalFilename: String(response.original_filename || file.name || '')
      });
    });
    request.addEventListener('error', () => fail(new MediaUploadError(
      'Falha de rede durante o envio da imagem.',
      'media/network-error'
    )));
    request.addEventListener('timeout', () => fail(new MediaUploadError(
      'O envio demorou demais. Tente novamente.',
      'media/timeout'
    )));
    request.addEventListener('abort', () => fail(new MediaUploadError(
      'Envio cancelado.',
      'media/aborted'
    )));

    options.signal?.addEventListener('abort', abortUpload, { once: true });
    request.send(formData);
  });
}

