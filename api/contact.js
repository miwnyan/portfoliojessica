const configuredUserId = String(process.env.DISCORD_CONTACT_USER_ID || '1215077795651133479');
const CONTACT_USER_ID = /^\d{17,20}$/.test(configuredUserId) ? configuredUserId : '1215077795651133479';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const recentRequests = new Map();

function reply(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function clean(value, maxLength) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim();
  try {
    return new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

function getWebhookUrl() {
  const raw = String(
    process.env.DISCORD_WEBHOOK_URL
    || process.env.PORTFOLIO_DISCORD_WEBHOOK_URL
    || process.env.DISCORD_WEBHOOK
    || process.env.VITE_DISCORD_WEBHOOK_URL
    || ''
  ).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const validHost = url.hostname === 'discord.com' || url.hostname === 'discordapp.com';
    return url.protocol === 'https:' && validHost && url.pathname.startsWith('/api/webhooks/') ? url : null;
  } catch {
    return null;
  }
}

function isRateLimited(request) {
  const now = Date.now();
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const recent = (recentRequests.get(ip) || []).filter(timestamp => now - timestamp < RATE_WINDOW_MS);
  recent.push(now);
  recentRequests.set(ip, recent);
  return recent.length > RATE_MAX;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    reply(response, 405, { ok: false, error: 'Método não permitido.' });
    return;
  }
  if (!isAllowedOrigin(request)) {
    reply(response, 403, { ok: false, error: 'Origem não permitida.' });
    return;
  }
  if (isRateLimited(request)) {
    reply(response, 429, { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos antes de enviar novamente.' });
    return;
  }

  let body = request.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      reply(response, 400, { ok: false, error: 'Conteúdo inválido.' });
      return;
    }
  }
  const honeypot = clean(body.website, 200);
  if (honeypot) {
    reply(response, 200, { ok: true });
    return;
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const message = clean(body.message, 3000);
  if (name.length < 2 || !EMAIL_PATTERN.test(email) || message.length < 2) {
    reply(response, 400, { ok: false, error: 'Confira seu nome, e-mail e mensagem.' });
    return;
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    reply(response, 503, { ok: false, error: 'O envio está temporariamente indisponível. Tente novamente mais tarde.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const discordResponse = await fetch(`${webhookUrl.href}${webhookUrl.search ? '&' : '?'}wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        content: `<@${CONTACT_USER_ID}>`,
        allowed_mentions: { parse: [], users: [CONTACT_USER_ID] },
        username: 'Portfólio da Jéssica',
        embeds: [{
          title: 'Nova mensagem pelo portfólio',
          color: 15642064,
          description: message,
          fields: [
            { name: 'Nome', value: name, inline: true },
            { name: 'E-mail', value: email, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
    if (!discordResponse.ok) {
      console.error('Falha no webhook de contato:', discordResponse.status);
      reply(response, 502, { ok: false, error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' });
      return;
    }
    reply(response, 200, { ok: true });
  } catch (error) {
    console.error('Falha no envio do formulário de contato:', error instanceof Error ? error.message : error);
    reply(response, 502, { ok: false, error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' });
  } finally {
    clearTimeout(timeout);
  }
}
