import assert from 'node:assert/strict';

process.env.GROQ_API_KEY = 'test-only-groq-key';
process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
process.env.VITE_FIREBASE_API_KEY = 'firebase-test-key';
process.env.VITE_FIREBASE_PROJECT_ID = 'portfolio-test';

const {
  ALLOWED_OPERATIONS,
  authorizeAdmin,
  buildAdminSystemPrompt,
  default: handler,
  safeAdminAnswer
} = await import('../api/admin-chat.js');

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async text() { return JSON.stringify(data); }
  };
}

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

const noToken = await authorizeAdmin({ headers: {} }, { fetchImpl: async () => { throw new Error('should not call'); } });
assert.equal(noToken.status, 401);

const invalidToken = await authorizeAdmin(
  { headers: { authorization: 'Bearer invalid' } },
  { fetchImpl: async () => jsonResponse(400, { error: 'INVALID_ID_TOKEN' }) }
);
assert.equal(invalidToken.status, 401);

let inactiveCall = 0;
const inactiveAdmin = await authorizeAdmin(
  { headers: { authorization: 'Bearer valid-token' } },
  {
    fetchImpl: async () => ++inactiveCall === 1
      ? jsonResponse(200, { users: [{ localId: 'user-1' }] })
      : jsonResponse(200, { fields: { active: { booleanValue: false } } })
  }
);
assert.equal(inactiveAdmin.status, 403);

const prompt = buildAdminSystemPrompt({ projects: [] }, 'projects', null);
assert.match(prompt, /DADOS NÃO CONFIÁVEIS/);
assert.match(prompt, /Toda mudança deve ser uma proposta explícita/);
assert.match(prompt, /Nyan/);
assert.ok(ALLOWED_OPERATIONS.includes('import_github_project'));

const malformedProposal = safeAdminAnswer(JSON.stringify({
  reply: 'Vou aplicar.',
  intent: 'proposal',
  proposalSummary: 'Teste',
  missingFields: [],
  operations: [{ type: 'execute_code', payloadJson: '{}' }]
}));
assert.equal(malformedProposal.intent, 'clarify');
assert.deepEqual(malformedProposal.operations, []);

const originalFetch = globalThis.fetch;
let groqBody;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('identitytoolkit.googleapis.com')) {
    assert.deepEqual(JSON.parse(options.body), { idToken: 'active-token' });
    return jsonResponse(200, { users: [{ localId: 'admin-1', disabled: false }] });
  }
  if (target.includes('firestore.googleapis.com')) {
    assert.equal(options.headers.Authorization, 'Bearer active-token');
    return jsonResponse(200, { fields: { active: { booleanValue: true }, disabled: { booleanValue: false } } });
  }
  if (target.includes('api.groq.com')) {
    groqBody = JSON.parse(options.body);
    return jsonResponse(200, {
      choices: [{ message: { content: JSON.stringify({
        reply: 'Preparei a experiência para sua confirmação.',
        intent: 'proposal',
        proposalSummary: 'Adicionar experiência na Empresa X',
        missingFields: [],
        operations: [{
          type: 'add_experience',
          payloadJson: JSON.stringify({ title: 'Desenvolvedora', institution: 'Empresa X', period: '2026', description: 'Desenvolvimento de sistemas.' })
        }]
      }) } }]
    });
  }
  throw new Error(`Unexpected URL: ${target}`);
};

try {
  const unauthorizedResponse = responseRecorder();
  await handler({ method: 'POST', headers: { host: 'localhost:5173' }, body: { message: 'Teste' } }, unauthorizedResponse);
  assert.equal(unauthorizedResponse.statusCode, 401);

  const authorizedResponse = responseRecorder();
  await handler({
    method: 'POST',
    headers: { host: 'localhost:5173', origin: 'http://localhost:5173', authorization: 'Bearer active-token' },
    body: { message: 'Adicione uma experiência', history: [], portfolio: { projects: [], experiences: [] }, currentSection: 'experiences' }
  }, authorizedResponse);
  assert.equal(authorizedResponse.statusCode, 200);
  assert.equal(authorizedResponse.payload.intent, 'proposal');
  assert.equal(authorizedResponse.payload.operations[0].type, 'add_experience');
  assert.equal(groqBody.response_format.type, 'json_schema');
  assert.equal(groqBody.response_format.json_schema.strict, true);
  assert.equal(groqBody.messages[0].role, 'system');
  assert.deepEqual(JSON.parse(groqBody.messages.at(-1).content), { untrusted_admin_message: 'Adicione uma experiência' });
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Admin chat API tests passed');
