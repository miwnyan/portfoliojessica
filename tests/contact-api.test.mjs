import assert from 'node:assert/strict';

process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/token-for-test';
process.env.DISCORD_CONTACT_USER_ID = '1215077795651133479';

let sentPayload;
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/discord\.com\/api\/webhooks\//);
  sentPayload = JSON.parse(options.body);
  return { ok: true, status: 200 };
};

const { default: handler } = await import('../api/contact.js');

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(value) { this.payload = JSON.parse(value); }
  };
}

const response = responseRecorder();
await handler({
  method: 'POST',
  headers: { origin: 'https://portfolio.example', host: 'portfolio.example' },
  body: {
    name: 'Visitante',
    email: 'visitante@example.com',
    message: 'Olá, gostaria de conversar sobre um projeto.',
    website: ''
  }
}, response);

assert.equal(response.statusCode, 200);
assert.deepEqual(response.payload, { ok: true });
assert.equal(sentPayload.content, '<@1215077795651133479>');
assert.deepEqual(sentPayload.allowed_mentions.users, ['1215077795651133479']);
assert.equal(sentPayload.embeds[0].fields[1].value, 'visitante@example.com');

const invalidResponse = responseRecorder();
await handler({
  method: 'POST',
  headers: { origin: 'https://portfolio.example', host: 'portfolio.example' },
  body: { name: 'A', email: 'inválido', message: '' }
}, invalidResponse);
assert.equal(invalidResponse.statusCode, 400);

console.log('Contact API tests passed');
