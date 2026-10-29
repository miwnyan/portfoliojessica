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

function cloudinaryError(response, status) {
  const message = response?.error?.message || response?.message;
  return new MediaUploadError(
    message ? `Cloudinary recusou o envio: ${message}` : 'Não foi possível enviar a imagem ao Cloudinary.',
    status === 413 ? 'media/file-too-large' : 'media/cloudinary-error',
    { status }
  );
}

const validCloudinaryConfig = config => /^[a-zA-Z0-9_-]+$/.test(config.cloudName)
  && /^[a-zA-Z0-9_-]+$/.test(config.uploadPreset);

async function resolveCloudinaryConfig() {
  const buildConfig = { cloudName: buildCloudName, uploadPreset: buildUploadPreset };
  if (validCloudinaryConfig(buildConfig)) return buildConfig;

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

/**
 * Upload unsigned e direto para o Cloudinary. Nenhum segredo ou API key é
 * enviado pelo navegador; o preset deve restringir pasta, formatos e tamanho.
 */
export async function uploadMedia(file, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const validation = validateMediaFile(file);

  if (!validation.valid) {
    throw new MediaUploadError(validation.error, validation.code, validation);
  }
  const { cloudName, uploadPreset } = await resolveCloudinaryConfig();
  if (!validCloudinaryConfig({ cloudName, uploadPreset })) {
    throw new MediaUploadError(
      'O upload de imagens está indisponível. Confirme o Cloud name e o preset unsigned no ambiente da publicação.',
      'media/not-configured'
    );
  }
  if (options.signal?.aborted) {
    throw new MediaUploadError('Envio cancelado.', 'media/aborted');
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
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', safeFolder(options.folder));
    if (options.publicId) {
      formData.append('public_id', String(options.publicId).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120));
    }
    if (Array.isArray(options.tags) && options.tags.length) {
      const tags = options.tags
        .map(tag => String(tag).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40))
        .filter(Boolean)
        .slice(0, 20);
      if (tags.length) formData.append('tags', tags.join(','));
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
        fail(cloudinaryError(response, request.status));
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

