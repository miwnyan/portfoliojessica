import assert from 'node:assert/strict';

process.env.CLOUDINARY_CLOUD_NAME = 'portfolio-cloud';
process.env.CLOUDINARY_UPLOAD_PRESET = 'portfolio-unsigned';

const { default: handler } = await import('../api/public-config.js');

const response = {
  statusCode: 0,
  headers: {},
  payload: null,
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.payload = value; }
};

handler({ method: 'GET' }, response);

assert.equal(response.statusCode, 200);
assert.equal(response.payload.cloudinary.configured, true);
assert.equal(response.payload.cloudinary.unsignedAvailable, true);
assert.equal(response.payload.cloudinary.signedAvailable, false);
assert.equal(response.payload.cloudinary.cloudName, 'portfolio-cloud');
assert.equal(response.payload.cloudinary.uploadPreset, 'portfolio-unsigned');
assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');

console.log('Public config API tests passed');
