import assert from 'node:assert/strict';

process.env.FIREBASE_API_KEY = 'firebase-public-api-key';
process.env.FIREBASE_PROJECT_ID = 'portfolio-project';
process.env.CLOUDINARY_CLOUD_NAME = 'portfolio-cloud';
process.env.CLOUDINARY_API_KEY = 'cloudinary-api-key';
process.env.CLOUDINARY_API_SECRET = 'cloudinary-private-secret';
process.env.CLOUDINARY_SIGNED_UPLOAD_PRESET = 'portfolio-signed';

const { default: handler, createCloudinarySignature } = await import('../api/cloudinary-signature.js');

function responseDouble() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(value = '') { this.payload = value ? JSON.parse(value) : null; }
  };
}

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('identitytoolkit.googleapis.com')) {
    return { ok: true, json: async () => ({ users: [{ localId: 'admin-uid' }] }) };
  }
  if (String(url).includes('/documents/admins/admin-uid')) {
    return {
      ok: true,
      json: async () => ({ fields: { active: { booleanValue: true }, disabled: { booleanValue: false } } })
    };
  }
  throw new Error(`URL inesperada: ${url}`);
};

try {
  const unauthorized = responseDouble();
  await handler({ method: 'POST', headers: { host: 'localhost:5173' }, body: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const forbiddenOrigin = responseDouble();
  await handler({
    method: 'POST',
    headers: { host: 'portfolio.example', origin: 'https://malicioso.example', authorization: 'Bearer token' },
    body: {}
  }, forbiddenOrigin);
  assert.equal(forbiddenOrigin.statusCode, 403);

  const response = responseDouble();
  await handler({
    method: 'POST',
    headers: { host: 'portfolio.example', origin: 'https://portfolio.example', authorization: 'Bearer valid-token' },
    body: {
      folder: 'portfolio-jessica/project-cover',
      publicId: 'Minha capa! ../',
      tags: ['portfolio', 'projeto especial']
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.cloudName, 'portfolio-cloud');
  assert.equal(response.payload.apiKey, 'cloudinary-api-key');
  assert.equal(response.payload.parameters.folder, 'portfolio-jessica/project-cover');
  assert.equal(response.payload.parameters.public_id, 'Minha-capa-');
  assert.equal(response.payload.parameters.tags, 'portfolio,projeto-especial');
  assert.equal(response.payload.parameters.upload_preset, 'portfolio-signed');
  assert.equal(
    response.payload.signature,
    createCloudinarySignature(response.payload.parameters, process.env.CLOUDINARY_API_SECRET)
  );
  assert.equal(JSON.stringify(response.payload).includes(process.env.CLOUDINARY_API_SECRET), false);
  assert.equal(calls.length, 2);
  assert.match(calls[1].options.headers.Authorization, /^Bearer /);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Cloudinary signature API tests passed');
