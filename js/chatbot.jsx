import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import NyanOrb from './components/NyanOrb.jsx';
import './chatbot.css';

const STORAGE_KEY = 'jessica-portfolio-chat:v1';
const MAX_THREADS = 12;
const MAX_SAVED_MESSAGES = 30;
const WELCOME = 'Oi! Eu sou a Nyan. Posso responder dúvidas sobre a Jéssica, os projetos e as habilidades dela — ou ajudar você a enviar uma mensagem.';
const FALLBACK = 'Não encontrei essa informação no portfólio. Você pode tocar em “Enviar mensagem” ou me dizer por aqui o que deseja enviar para a Jéssica.';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const QUICK_ACTIONS = [
  { id: 'about', label: 'Conhecer a Jéssica', message: 'Quem é a Jéssica?' },
  { id: 'projects', label: 'Ver projetos', message: 'Quais são os projetos?' },
  { id: 'skills', label: 'Ver habilidades', message: 'Quais são as principais habilidades?' },
  { id: 'contact', label: 'Enviar mensagem', contact: true }
];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();
const visible = items => (Array.isArray(items) ? items : [])
  .filter(item => item && item.visible !== false)
  .slice()
  .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

function makeMessage(role, content, extra = {}) {
  return { id: uid(), role, content: String(content), createdAt: now(), ...extra };
}

function makeThread() {
  const createdAt = now();
  return {
    id: uid(),
    title: 'Nova conversa',
    pinned: false,
    createdAt,
    updatedAt: createdAt,
    messages: [makeMessage('assistant', WELCOME, { source: 'local' })]
  };
}

function safeStoredThreads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_THREADS).flatMap(thread => {
      if (!thread || typeof thread.id !== 'string' || !Array.isArray(thread.messages)) return [];
      const messages = thread.messages.slice(-MAX_SAVED_MESSAGES).flatMap(message => {
        if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return [];
        if (EMAIL_PATTERN.test(message.content)) return [];
        const content = message.role === 'assistant'
          ? message.content.replace(/\bLumi\b/g, 'Nyan')
          : message.content;
        return [{
          id: String(message.id || uid()),
          role: message.role,
          content: content.slice(0, 1200),
          source: message.source === 'ai' ? 'ai' : 'local',
          offerContact: Boolean(message.offerContact),
          createdAt: String(message.createdAt || now())
        }];
      });
      if (!messages.length) return [];
      return [{
        id: thread.id,
        title: String(thread.title || 'Conversa').slice(0, 52),
        pinned: Boolean(thread.pinned),
        createdAt: String(thread.createdAt || now()),
        updatedAt: String(thread.updatedAt || now()),
        messages
      }];
    });
  } catch {
    return [];
  }
}

export function createPortfolioContext(data = {}) {
  const settings = data.settings || {};
  const hero = settings.hero || {};
  const about = settings.about || {};
  return {
    profile: {
      name: hero.name || settings.footer?.name || 'Jéssica Montes Santos',
      headline: hero.subtitle || '',
      description: hero.description || '',
      about: Array.isArray(about.paragraphs) ? about.paragraphs : []
    },
    projects: visible(data.projects).map(project => ({
      name: project.name || '',
      summary: project.summary || '',
      description: project.description || '',
      technologies: Array.isArray(project.technologies) ? project.technologies : [],
      repositoryUrl: project.repositoryUrl || '',
      homepageUrl: project.homepageUrl || ''
    })),
    experience: visible(data.experiences).map(item => ({
      period: item.period || '',
      title: item.title || '',
      institution: item.institution || '',
      description: item.description || ''
    })),
    skills: visible(data.skills).map(skill => ({
      name: skill.name || skill.title || '',
      status: skill.status || '',
      description: skill.description || ''
    })),
    contacts: visible(data.contacts).map(contact => ({
      label: contact.label || '',
      url: contact.url || ''
    }))
  };
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function wantsConversationalContact(value) {
  const text = normalizeText(value);
  return EMAIL_PATTERN.test(value)
    || /\b(?:quero|gostaria|preciso|posso|vou)\b.{0,42}\b(?:falar|conversar|mandar|enviar|escrever|contatar|contratar)\b/.test(text)
    || /\b(?:quero|gostaria|preciso|tenho interesse)\b.{0,42}\b(?:orcamento|proposta|contratacao)\b/.test(text)
    || /\b(?:mandar|enviar)\s+(?:uma\s+)?mensagem\b/.test(text);
}

function extractContactDetails(value, current = {}, expectedStep = '') {
  const raw = String(value || '').trim();
  const next = { name: current.name || '', email: current.email || '', message: current.message || '' };
  const email = raw.match(EMAIL_PATTERN)?.[0];
  if (email) next.email = email.toLowerCase();

  const named = raw.match(/\b(?:meu\s+nome\s+(?:é|eh|e)|me\s+chamo)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,80}?)(?=\s+(?:e\s+)?(?:(?:o|a)\s+)?(?:(?:meu|minha)\s+)?(?:e-?mail|email|mensagem)\b|[,.;\n]|$)/i);
  if (named?.[1]) next.name = named[1].trim();

  const explicitMessage = raw.match(/\b(?:a\s+)?mensagem(?:\s+que\s+(?:eu\s+)?quero\s+enviar)?\s*(?:é|eh|:)\s*["']?(.+?)["']?$/i)
    || raw.match(/\bmensagem\s+(?:dizendo|falando)\s+["']?(.+?)["']?$/i);
  if (explicitMessage?.[1]) next.message = explicitMessage[1].trim();

  const about = raw.match(/\b(?:quero|gostaria|preciso)\s+(?:falar|conversar)\s+(?:com\s+(?:ela|a\s+jéssica)\s+)?(?:sobre|a\s+respeito\s+de)\s+(.+)$/i);
  if (!next.message && about?.[1]) next.message = `Gostaria de conversar sobre ${about[1].trim()}`;

  if (expectedStep === 'message' && !next.message && raw.length >= 2) next.message = raw.slice(0, 3000);
  if (expectedStep === 'name' && !next.name) {
    next.name = raw.replace(/^(?:meu\s+nome\s+(?:é|eh|e)|me\s+chamo)\s+/i, '').trim().slice(0, 100);
  }
  return next;
}

function nextContactStep(draft) {
  if (!draft.message || draft.message.length < 2) {
    return { step: 'message', text: 'Claro. O que você gostaria de dizer para a Jéssica? Escreva a mensagem por aqui.' };
  }
  if (!EMAIL_PATTERN.test(draft.email)) {
    return { step: 'email', text: 'Entendi a mensagem. Qual e-mail a Jéssica pode usar para responder você?' };
  }
  if (!draft.name || draft.name.length < 2) {
    return { step: 'name', text: 'Perfeito. Agora, qual é o seu nome?' };
  }
  return {
    step: 'confirm',
    text: `Confira antes de enviar:\n\nNome: ${draft.name}\nE-mail: ${draft.email}\nMensagem: ${draft.message}\n\nPosso enviar agora?`,
    contactConfirmation: true
  };
}

function isAffirmative(value) {
  return /^(?:sim|pode|confirmo|envia|enviar|mande|mandar|ok|claro)(?:[\s,.!]|$)/i.test(String(value || '').trim());
}

function isNegative(value) {
  return /^(?:não|nao|cancela|cancelar|desiste|desistir)(?:[\s,.!]|$)/i.test(String(value || '').trim());
}

function localAnswer(input, context) {
  const text = normalizeText(input);
  const profile = context.profile || {};
  const projects = context.projects || [];
  const skills = context.skills || [];

  if (text.length < 2) {
    return { answer: 'Não consegui entender ainda. Você pode escrever um pouco mais, por exemplo “projetos”, “LinkedIn” ou “quero enviar uma mensagem”?', source: 'local' };
  }

  if (/^(oi+|ola|hey|bom dia|boa tarde|boa noite|e ai)[!.?\s]*$/.test(text)) {
    return { answer: 'Oi! Posso contar sobre a trajetória, os projetos e as habilidades da Jéssica. O que você quer conhecer?', source: 'local' };
  }
  if (/\b(obrigad[oa]|valeu|agradeco)\b/.test(text)) {
    return { answer: 'Por nada! Se surgir outra dúvida, é só me chamar.', source: 'local' };
  }
  if (/\b(?:linkedin|linked in|linkdin|likedin)\b/.test(text)) {
    const contact = (context.contacts || []).find(item => normalizeText(item.label).includes('linkedin'));
    return contact?.url
      ? { answer: `LinkedIn da Jéssica: ${contact.url}`, source: 'local' }
      : { answer: FALLBACK, source: 'local', offerContact: true };
  }
  if (/\b(?:github|git hub)\b/.test(text) && !/\bprojeto\b/.test(text)) {
    const contact = (context.contacts || []).find(item => normalizeText(item.label).includes('github'));
    return contact?.url
      ? { answer: `GitHub da Jéssica: ${contact.url}`, source: 'local' }
      : { answer: FALLBACK, source: 'local', offerContact: true };
  }
  if (/\b(contato|falar com|mensagem|email|e-mail|contratar)\b/.test(text)) {
    return { answer: 'Você pode tocar em “Enviar mensagem” para abrir o formulário ou me dizer diretamente por aqui o que deseja enviar. Eu vou pedir somente a mensagem, seu e-mail e seu nome.', source: 'local', offerContact: true };
  }
  if (/\b(quem e|sobre (ela|a jessica)|apresente|perfil)\b/.test(text)) {
    const about = [profile.description, ...(profile.about || []).slice(0, 1)].filter(Boolean).join(' ');
    return about
      ? { answer: about.slice(0, 700), source: 'local' }
      : { answer: FALLBACK, source: 'local', offerContact: true };
  }
  if (/\b(projetos?|portfolio|trabalhos?)\b/.test(text) && (/\b(quais|listar|mostre|ver|tem|principais)\b/.test(text) || text.split(' ').length <= 2)) {
    if (!projects.length) return { answer: FALLBACK, source: 'local', offerContact: true };
    const names = projects.slice(0, 6).map(project => project.name).filter(Boolean);
    return { answer: `Os projetos em destaque são ${new Intl.ListFormat('pt-BR').format(names)}. Posso explicar qualquer um deles em mais detalhes.`, source: 'local' };
  }
  if (/\b(habilidades?|tecnologias?|stack|competencias?)\b/.test(text) && (/\b(quais|listar|mostre|tem|principais)\b/.test(text) || text.split(' ').length <= 2)) {
    if (!skills.length) return { answer: FALLBACK, source: 'local', offerContact: true };
    const names = skills.slice(0, 10).map(skill => skill.name).filter(Boolean);
    return { answer: `Entre as habilidades apresentadas estão ${new Intl.ListFormat('pt-BR').format(names)}. Posso detalhar uma tecnologia específica.`, source: 'local' };
  }
  return null;
}

function LinkifiedText({ text }) {
  const expression = /(https?:\/\/[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const nodes = [];
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const raw = match[0];
    const trailing = raw.match(/[.,;:!?]+$/)?.[0] || '';
    const label = trailing ? raw.slice(0, -trailing.length) : raw;
    const href = label.includes('@') && !label.startsWith('http') ? `mailto:${label}` : label;
    nodes.push(<a key={`${match.index}-${label}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>{label}</a>);
    if (trailing) nodes.push(trailing);
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function Icon({ name }) {
  const paths = {
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6M12 7v5l3 2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    pin: <><path d="m9 4 6 0-1 6 3 3H7l3-3zM12 13v7" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    send: <><path d="m3 11 18-8-8 18-2-8zM11 13l5-5" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    sparkle: <><path d="m12 3 1.1 3.9L17 8l-3.9 1.1L12 13l-1.1-3.9L7 8l3.9-1.1zM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function TypingDots() {
  return <div className="chat-typing" role="status" aria-label="Nyan está digitando"><span /><span /><span /></div>;
}

function Typewriter({ text, active, onDone }) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [length, setLength] = useState(active && !reducedMotion ? 0 : text.length);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!active || reducedMotion) {
      setLength(text.length);
      return undefined;
    }
    setLength(0);
    let position = 0;
    const timer = window.setInterval(() => {
      position = Math.min(text.length, position + 3);
      setLength(position);
      if (position >= text.length) {
        window.clearInterval(timer);
        doneRef.current?.();
      }
    }, 18);
    return () => window.clearInterval(timer);
  }, [active, reducedMotion, text]);

  return <><LinkifiedText text={text.slice(0, length)} />{active && length < text.length ? <span className="chat-caret" aria-hidden="true" /> : null}</>;
}

function ContactPanel({ onBack, onSent }) {
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || sending) return;
    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      website: form.elements.website.value.trim()
    };
    setSending(true);
    setStatus({ state: 'idle', message: 'Enviando com segurança…' });
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível enviar agora.');
      form.reset();
      setStatus({ state: 'success', message: 'Mensagem enviada. A Jéssica recebeu seu contato.' });
      onSent();
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Não foi possível enviar agora.' });
    } finally {
      setSending(false);
    }
  }

  return <section className="chat-contact" aria-labelledby="chat-contact-title">
    <button className="chat-back" type="button" onClick={onBack}><Icon name="back" /> Voltar à conversa</button>
    <div className="chat-contact-heading">
      <span className="chat-contact-mark"><Icon name="send" /></span>
      <div><h3 id="chat-contact-title">Enviar mensagem</h3><p>Vai direto para o canal de contato da Jéssica.</p></div>
    </div>
    <form onSubmit={submit}>
      <div className="chat-honeypot" aria-hidden="true"><label htmlFor="chat-website">Não preencha</label><input id="chat-website" name="website" tabIndex="-1" autoComplete="off" /></div>
      <label htmlFor="chat-contact-name">Nome</label>
      <input id="chat-contact-name" name="name" minLength="2" maxLength="100" autoComplete="name" required />
      <label htmlFor="chat-contact-email">E-mail</label>
      <input id="chat-contact-email" name="email" type="email" maxLength="200" autoComplete="email" required />
      <label htmlFor="chat-contact-message">Mensagem</label>
      <textarea id="chat-contact-message" name="message" rows="4" minLength="2" maxLength="3000" required />
      <button className="chat-contact-submit" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar mensagem'} <Icon name="send" /></button>
      <p className={`chat-contact-status is-${status.state}`} role="status" aria-live="polite">{status.message}</p>
    </form>
  </section>;
}

function Chatbot({ getPortfolioData }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState(() => {
    const stored = safeStoredThreads();
    return stored.length ? stored : [makeThread()];
  });
  const [activeId, setActiveId] = useState(() => threads[0].id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  const fabRef = useRef(null);
  const activeThread = threads.find(thread => thread.id === activeId) || threads[0];

  useEffect(() => {
    try {
      const compact = threads.slice(0, MAX_THREADS).map(thread => ({
        ...thread,
        messages: thread.messages.filter(message => !message.private).slice(-MAX_SAVED_MESSAGES)
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // O chat continua funcionando quando o armazenamento está bloqueado ou cheio.
    }
  }, [threads]);

  useEffect(() => {
    if (open && !contactOpen && !historyOpen) window.setTimeout(() => inputRef.current?.focus(), 220);
    if (!open) setHistoryOpen(false);
  }, [contactOpen, historyOpen, open]);

  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [activeThread?.messages, sending, contactOpen]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        window.setTimeout(() => fabRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function mutateActive(updater) {
    setThreads(current => current.map(thread => thread.id === activeId ? updater(thread) : thread));
  }

  function appendMessage(role, content, extra = {}) {
    const message = makeMessage(role, content, extra);
    mutateActive(thread => {
      const userMessages = role === 'user' ? [...thread.messages, message].filter(item => item.role === 'user' && !item.private) : [];
      const firstQuestion = userMessages[0]?.content || '';
      return {
        ...thread,
        title: thread.title === 'Nova conversa' && extra.private
          ? 'Contato com Jéssica'
          : thread.title === 'Nova conversa' && firstQuestion
            ? firstQuestion.slice(0, 42)
            : thread.title,
        updatedAt: now(),
        messages: [...thread.messages, message].slice(-MAX_SAVED_MESSAGES)
      };
    });
    if (role === 'assistant') setAnimatingId(message.id);
    return message;
  }

  function startNewThread() {
    const thread = makeThread();
    setThreads(current => [thread, ...current].slice(0, MAX_THREADS));
    setActiveId(thread.id);
    setHistoryOpen(false);
    setContactOpen(false);
    setContactDraft(null);
    setAnimatingId(null);
  }

  function deleteThread(threadId) {
    setThreads(current => {
      const remaining = current.filter(thread => thread.id !== threadId);
      if (remaining.length) {
        if (threadId === activeId) setActiveId(remaining[0].id);
        return remaining;
      }
      const replacement = makeThread();
      setActiveId(replacement.id);
      return [replacement];
    });
  }

  function selectThread(threadId) {
    setActiveId(threadId);
    setHistoryOpen(false);
    setContactOpen(false);
    setContactDraft(null);
    setAnimatingId(null);
  }

  function togglePin() {
    mutateActive(thread => ({ ...thread, pinned: !thread.pinned, updatedAt: now() }));
  }

  function openContactForm() {
    setContactDraft(null);
    setContactOpen(true);
  }

  async function deliverContact(draft) {
    setSending(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          message: draft.message,
          website: ''
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível enviar agora.');
      setContactDraft(null);
      appendMessage('assistant', 'Mensagem enviada com sucesso. A Jéssica recebeu seu contato e poderá responder pelo e-mail informado.', { source: 'local' });
    } catch (error) {
      appendMessage('assistant', `${error instanceof Error ? error.message : 'Não foi possível enviar agora.'} Você pode tentar novamente ou usar o formulário.`, { source: 'local', offerContact: true });
    } finally {
      setSending(false);
    }
  }

  async function handleConversationalContact(message, existingDraft) {
    if (existingDraft?.step === 'confirm') {
      if (isAffirmative(message)) {
        await deliverContact(existingDraft);
        return;
      }
      if (isNegative(message)) {
        setContactDraft(null);
        window.setTimeout(() => appendMessage('assistant', 'Envio cancelado. Nenhuma mensagem foi enviada.', { source: 'local' }), 180);
        return;
      }
      window.setTimeout(() => appendMessage('assistant', 'Responda “sim” para enviar ou “cancelar”. Se quiser alterar algo, cancele e comece novamente.', { source: 'local', contactConfirmation: true }), 180);
      return;
    }

    const next = extractContactDetails(message, existingDraft || {}, existingDraft?.step || '');
    const prompt = nextContactStep(next);
    const draft = { ...next, threadId: activeId, step: prompt.step };
    setContactDraft(draft);
    window.setTimeout(() => appendMessage('assistant', prompt.text, {
      source: 'local',
      private: prompt.step === 'confirm',
      contactConfirmation: Boolean(prompt.contactConfirmation)
    }), 180);
  }

  async function send(rawMessage) {
    const message = String(rawMessage ?? input).trim().slice(0, 700);
    if (!message || sending) return;
    const portfolioContext = createPortfolioContext(getPortfolioData());
    const history = activeThread.messages
      .filter(item => item.content !== WELCOME && !item.private)
      .slice(-10)
      .map(item => ({ role: item.role, content: item.content }));
    const existingDraft = contactDraft?.threadId === activeId ? contactDraft : null;
    const contactIntent = Boolean(existingDraft) || wantsConversationalContact(message);
    appendMessage('user', message, contactIntent ? { private: true } : {});
    setInput('');

    if (contactIntent) {
      await handleConversationalContact(message, existingDraft);
      return;
    }

    const predefined = localAnswer(message, portfolioContext);
    if (predefined) {
      window.setTimeout(() => appendMessage('assistant', predefined.answer, predefined), 260);
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message, history, context: portfolioContext })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.fallback || result.error || FALLBACK);
      appendMessage('assistant', result.answer || FALLBACK, {
        source: result.source === 'portfolio' ? 'ai' : 'local',
        offerContact: Boolean(result.offerContact)
      });
    } catch (error) {
      appendMessage('assistant', error instanceof Error && error.message ? error.message : FALLBACK, { source: 'local', offerContact: true });
    } finally {
      setSending(false);
    }
  }

  const sortedThreads = [...threads].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const isAnimating = Boolean(animatingId);

  return <div className={`portfolio-chat ${open ? 'is-open' : ''}`}>
    <section className="chat-window" role="dialog" aria-modal="false" aria-label="Assistente virtual do portfólio" aria-hidden={!open}>
      <header className="chat-header">
        <div className="chat-identity"><NyanOrb className="chat-mini-orb" active={sending || isAnimating} /><div><strong>Nyan</strong><span><i /> Assistente do portfólio</span></div></div>
        <div className="chat-header-actions">
          <button type="button" onClick={() => setHistoryOpen(value => !value)} aria-label="Ver conversas" aria-expanded={historyOpen}><Icon name="history" /></button>
          <button type="button" onClick={startNewThread} aria-label="Nova conversa"><Icon name="plus" /></button>
          <button className={activeThread?.pinned ? 'is-active' : ''} type="button" onClick={togglePin} aria-label={activeThread?.pinned ? 'Desmarcar conversa' : 'Marcar conversa'} aria-pressed={Boolean(activeThread?.pinned)}><Icon name="pin" /></button>
          <button type="button" onClick={() => { setOpen(false); window.setTimeout(() => fabRef.current?.focus(), 0); }} aria-label="Fechar chat"><Icon name="close" /></button>
        </div>
      </header>

      {historyOpen ? <aside className="chat-history" aria-label="Conversas salvas">
        <div className="chat-history-heading"><div><strong>Conversas</strong></div><button type="button" onClick={startNewThread}><Icon name="plus" /> Nova</button></div>
        <div className="chat-thread-list">
          {sortedThreads.map(thread => <div className={`chat-thread ${thread.id === activeId ? 'is-current' : ''}`} key={thread.id}>
            <button className="chat-thread-select" type="button" onClick={() => selectThread(thread.id)}>
              <span>{thread.pinned ? 'Marcada' : 'Conversa'}</span><strong>{thread.title}</strong><small>{new Date(thread.updatedAt).toLocaleDateString('pt-BR')}</small>
            </button>
            <button className="chat-thread-delete" type="button" onClick={() => deleteThread(thread.id)} aria-label={`Excluir ${thread.title}`}><Icon name="trash" /></button>
          </div>)}
        </div>
      </aside> : contactOpen ? <ContactPanel onBack={() => setContactOpen(false)} onSent={() => appendMessage('assistant', 'Mensagem enviada com sucesso. A Jéssica recebeu seu contato e poderá responder pelo e-mail informado.', { source: 'local' })} /> : <>
        <div className="chat-messages" ref={messagesRef} aria-live="polite" aria-busy={sending}>
          {activeThread?.messages.map(message => <div className={`chat-row is-${message.role}`} key={message.id}>
            <div className="chat-bubble">
              <p><Typewriter text={message.content} active={message.id === animatingId} onDone={() => setAnimatingId(null)} /></p>
              {message.offerContact ? <button className="chat-inline-contact" type="button" onClick={openContactForm}>Enviar mensagem <Icon name="send" /></button> : null}
              {message.contactConfirmation && contactDraft?.threadId === activeId && contactDraft.step === 'confirm' ? <div className="chat-confirm-actions">
                <button type="button" onClick={() => send('Sim')}>Enviar agora <Icon name="send" /></button>
                <button type="button" onClick={() => send('Cancelar')}>Cancelar</button>
              </div> : null}
            </div>
          </div>)}
          {sending ? <div className="chat-row is-assistant"><TypingDots /></div> : null}
        </div>

        {activeThread?.messages.length <= 1 ? <div className="chat-quick-actions" aria-label="Sugestões">
          {QUICK_ACTIONS.map(action => <button key={action.id} type="button" onClick={() => action.contact ? openContactForm() : send(action.message)}>{action.label}{action.contact ? <Icon name="send" /> : null}</button>)}
        </div> : null}

        <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
          <label className="sr-only" htmlFor="portfolio-chat-input">Digite sua pergunta</label>
          <textarea id="portfolio-chat-input" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }} rows="1" maxLength="700" placeholder="Pergunte sobre o portfólio…" disabled={sending} />
          <button type="submit" disabled={sending || !input.trim()} aria-label="Enviar pergunta"><Icon name="send" /></button>
        </form>
      </>}
    </section>

    <div className="chat-launcher-wrap">
      <span className="chat-launcher-label" aria-hidden="true">Fale com a Nyan</span>
      <button ref={fabRef} className="chat-launcher" type="button" onClick={() => setOpen(value => !value)} aria-label={open ? 'Fechar assistente virtual' : 'Abrir assistente virtual'} aria-expanded={open}>
        <NyanOrb className="chat-launcher-orb" active={sending || isAnimating} interactive />
        <span className="chat-launcher-close" aria-hidden="true"><Icon name="close" /></span>
      </button>
    </div>
  </div>;
}

export function renderChatbot(container, getPortfolioData) {
  if (!container) return null;
  const root = createRoot(container);
  root.render(<Chatbot getPortfolioData={getPortfolioData} />);
  return root;
}
