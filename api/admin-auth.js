const clean = (value, maximum = 500) => String(value || '').trim().slice(0, maximum);

function bearerToken(request) {
  return String(request?.headers?.authorization || '').match(/^Bearer\s+([^\s]+)$/i)?.[1] || '';
}

function firebaseEnvironment(environment = process.env) {
  return {
    apiKey: clean(environment.FIREBASE_API_KEY || environment.VITE_FIREBASE_API_KEY),
    projectId: clean(environment.FIREBASE_PROJECT_ID || environment.VITE_FIREBASE_PROJECT_ID, 300)
  };
}

function firestoreBoolean(document, field, fallback = false) {
  const value = document?.fields?.[field]?.booleanValue;
  return typeof value === 'boolean' ? value : fallback;
}

/** Valida no servidor tanto o Firebase ID token quanto admins/{uid}.active. */
export async function authorizeAdmin(request, { fetchImpl = fetch, environment = process.env } = {}) {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Autenticação administrativa necessária.' };

  const { apiKey, projectId } = firebaseEnvironment(environment);
  if (!apiKey || !projectId) {
    return { ok: false, status: 503, error: 'A autenticação administrativa não está configurada no servidor.' };
  }

  let identityResponse;
  try {
    identityResponse = await fetchImpl(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );
  } catch {
    return { ok: false, status: 503, error: 'Não foi possível validar a sessão administrativa.' };
  }

  if (!identityResponse.ok) return { ok: false, status: 401, error: 'Sessão administrativa inválida ou expirada.' };
  const identity = await identityResponse.json().catch(() => null);
  const user = identity?.users?.[0];
  const uid = clean(user?.localId, 128);
  if (!uid || user?.disabled === true) return { ok: false, status: 401, error: 'Sessão administrativa inválida ou expirada.' };

  const adminUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  let adminResponse;
  try {
    adminResponse = await fetchImpl(adminUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
  } catch {
    return { ok: false, status: 503, error: 'Não foi possível verificar a permissão administrativa.' };
  }

  if (!adminResponse.ok) return { ok: false, status: 403, error: 'Esta conta não tem permissão administrativa.' };
  const document = await adminResponse.json().catch(() => null);
  if (!firestoreBoolean(document, 'active') || firestoreBoolean(document, 'disabled')) {
    return { ok: false, status: 403, error: 'Esta conta não tem permissão administrativa.' };
  }
  return { ok: true, uid, token };
}
