import assert from 'node:assert/strict';

const { uploadMedia } = await import('../js/media-service.js');

const originalFetch = globalThis.fetch;
const originalXHR = globalThis.XMLHttpRequest;
const uploads = [];
let mode = 'signed';

class FakeXMLHttpRequest {
  constructor() {
    this.listeners = {};
    this.upload = { addEventListener: () => {} };
    this.status = 0;
    this.response = null;
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  getResponseHeader() {
    return null;
  }

  send(formData) {
    uploads.push({ method: this.method, url: this.url, fields: new Map([...formData.entries()]) });
    this.status = 200;
    this.response = {
      secure_url: `https://res.cloudinary.com/${mode}/image/upload/example.png`,
      public_id: `${mode}/example`,
      width: 100,
      height: 60,
      bytes: 3,
      format: 'png',
      resource_type: 'image'
    };
    queueMicrotask(() => this.listeners.load?.());
  }

  abort() {
    this.listeners.abort?.();
  }
}

globalThis.XMLHttpRequest = FakeXMLHttpRequest;
globalThis.fetch = async url => {
  if (String(url) === '/api/cloudinary-signature') {
    if (mode === 'signed') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          cloudName: 'signed-cloud',
          apiKey: 'api-key',
          signature: 'a'.repeat(40),
          parameters: { folder: 'portfolio-jessica/test', timestamp: 123456, public_id: 'example' }
        })
      };
    }
    return { ok: false, status: 503, json: async () => ({ signedAvailable: false }) };
  }
  if (String(url) === '/api/public-config') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ cloudinary: { cloudName: 'unsigned-cloud', uploadPreset: 'unsigned-preset' } })
    };
  }
  throw new Error(`URL inesperada: ${url}`);
};

const file = new Blob(['png'], { type: 'image/png' });
Object.defineProperty(file, 'name', { value: 'example.png' });

try {
  const signedResult = await uploadMedia(file, {
    authToken: 'firebase-token',
    folder: 'portfolio-jessica/test',
    publicId: 'example'
  });
  assert.equal(signedResult.publicId, 'signed/example');
  assert.match(uploads[0].url, /\/signed-cloud\/image\/upload$/);
  assert.equal(uploads[0].fields.get('api_key'), 'api-key');
  assert.equal(uploads[0].fields.get('signature'), 'a'.repeat(40));
  assert.equal(uploads[0].fields.get('timestamp'), '123456');
  assert.equal(uploads[0].fields.has('upload_preset'), false);

  mode = 'unsigned';
  const unsignedResult = await uploadMedia(file, {
    authToken: 'firebase-token',
    folder: 'portfolio-jessica/test'
  });
  assert.equal(unsignedResult.publicId, 'unsigned/example');
  assert.match(uploads[1].url, /\/unsigned-cloud\/image\/upload$/);
  assert.equal(uploads[1].fields.get('upload_preset'), 'unsigned-preset');
  assert.equal(uploads[1].fields.get('folder'), 'portfolio-jessica/test');
  assert.equal(uploads[1].fields.has('signature'), false);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.XMLHttpRequest = originalXHR;
}

console.log('Media service tests passed');
