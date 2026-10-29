import nodemailer from 'nodemailer';

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

function cleanHeader(value, maxLength) {
  return clean(value, maxLength).replace(/\s+/g, ' ');
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

export function getSmtpConfig(environment = process.env) {
  const host = String(environment.SMTP_HOST || 'mail.privateemail.com').trim();
  const port = Number(environment.SMTP_PORT || 465);
  const user = String(environment.SMTP_USER || '').trim();
  const password = String(environment.SMTP_PASSWORD || '');
  const to = String(environment.CONTACT_EMAIL || user).trim();
  const secureValue = String(environment.SMTP_SECURE ?? (port === 465 ? 'true' : 'false')).toLowerCase();
  const secure = ['1', 'true', 'yes', 'on'].includes(secureValue);
  const fromName = cleanHeader(environment.SMTP_FROM_NAME || 'Portfólio da Jéssica', 100);

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!EMAIL_PATTERN.test(user) || !password || !EMAIL_PATTERN.test(to)) return null;
  return { host, port, secure, user, password, to, fromName };
}

function hasSmtpSettings(environment = process.env) {
  return ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'CONTACT_EMAIL']
    .some(name => String(environment[name] || '').trim());
}

export async function sendContactEmail({ name, email, message }, options = {}) {
  const config = options.config || getSmtpConfig(options.environment);
  if (!config) throw new Error('SMTP_NOT_CONFIGURED');
  const createTransport = options.createTransport || nodemailer.createTransport;
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    disableFileAccess: true,
    disableUrlAccess: true,
    maxRecipients: 1
  });

  await transporter.sendMail({
    from: { name: config.fromName, address: config.user },
    to: config.to,
    replyTo: { name: cleanHeader(name, 100), address: email },
    subject: `Nova mensagem do portfólio — ${cleanHeader(name, 100)}`,
    text: `Nome: ${name}\nE-mail: ${email}\n\nMensagem:\n${message}`
  });
}

async function sendDiscordNotification({ name, email, message }, webhookUrl) {
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
    if (!discordResponse.ok) throw new Error(`DISCORD_${discordResponse.status}`);
  } finally {
    clearTimeout(timeout);
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

  const smtpConfig = getSmtpConfig();
  const webhookUrl = getWebhookUrl();
  if (hasSmtpSettings() && !smtpConfig) {
    console.error('Configuração SMTP incompleta ou inválida.');
    reply(response, 503, { ok: false, error: 'O envio está temporariamente indisponível. Tente novamente mais tarde.' });
    return;
  }
  if (!smtpConfig && !webhookUrl) {
    reply(response, 503, { ok: false, error: 'O envio está temporariamente indisponível. Tente novamente mais tarde.' });
    return;
  }

  try {
    const contact = { name, email, message };
    if (smtpConfig) {
      await sendContactEmail(contact, { config: smtpConfig });
      if (webhookUrl) {
        try {
          await sendDiscordNotification(contact, webhookUrl);
        } catch (error) {
          console.error('Falha na notificação opcional do Discord:', error instanceof Error ? error.message : error);
        }
      }
    } else {
      await sendDiscordNotification(contact, webhookUrl);
    }
    reply(response, 200, { ok: true });
  } catch (error) {
    console.error('Falha no envio do formulário de contato:', error instanceof Error ? error.message : error);
    reply(response, 502, { ok: false, error: 'Não foi possível enviar agora. Tente novamente em alguns minutos.' });
  }
}
