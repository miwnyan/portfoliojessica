import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import NyanOrb from './components/NyanOrb.jsx';
import './admin-assistant.css';

const WELCOME = 'Sou a Nyan do painel. Posso criar e editar experiências, projetos, habilidades, contatos e textos. Descreva o que deseja; antes de qualquer alteração eu mostro uma proposta para você confirmar.';
const MAX_HISTORY = 12;
const urlPattern = /(?:https?:\/\/[^\s<]+|mailto:[^\s<]+)/gi;

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function linkify(text) {
  const value = String(text || '');
  const nodes = [];
  let cursor = 0;
  for (const match of value.matchAll(urlPattern)) {
    const raw = match[0];
    const trailing = raw.match(/[),.;!?]+$/)?.[0] || '';
    const url = trailing ? raw.slice(0, -trailing.length) : raw;
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    nodes.push(<a key={`${match.index}-${url}`} href={url} target={url.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">{url}</a>);
    if (trailing) nodes.push(trailing);
    cursor = match.index + raw.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes.length ? nodes : value;
}

function SendIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-8-8 18-2-8zM11 13l5-5" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function AdminAssistant({ getPortfolioData, getSection, getIdToken, prepareGitHubCandidate, applyProposal }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ id: uid(), role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      if (!sending) inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, messages, sending]);

  async function requestWithToken(payload, forceRefresh = false) {
    const token = await getIdToken(forceRefresh);
    return fetch('/api/admin-chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  }

  async function send() {
    const message = input.trim();
    if (sending || message.length < 2) return;
    const userMessage = { id: uid(), role: 'user', content: message };
    const history = messages.slice(-MAX_HISTORY).map(item => ({ role: item.role, content: item.content }));
    setMessages(current => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const githubCandidate = await prepareGitHubCandidate(message).catch(() => null);
      const payload = {
        message,
        history,
        portfolio: getPortfolioData(),
        currentSection: getSection(),
        githubCandidate
      };
      let response = await requestWithToken(payload);
      if (response.status === 401) response = await requestWithToken(payload, true);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a Nyan agora.');
      setMessages(current => [...current, {
        id: uid(),
        role: 'assistant',
        content: result.reply,
        proposal: result.intent === 'proposal' && result.operations?.length ? {
          summary: result.proposalSummary || 'Alterações propostas',
          operations: result.operations
        } : null
      }]);
    } catch (error) {
      setMessages(current => [...current, {
        id: uid(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Não foi possível consultar a Nyan agora.',
        error: true
      }]);
    } finally {
      setSending(false);
    }
  }

  async function apply(message) {
    if (!message.proposal || applyingId) return;
    setApplyingId(message.id);
    try {
      const result = await applyProposal(message.proposal.operations);
      setMessages(current => current.map(item => item.id === message.id ? { ...item, proposal: null, applied: true } : item).concat({
        id: uid(),
        role: 'assistant',
        content: result?.message || 'Alterações aplicadas ao painel. Revise o resultado e salve quando estiver tudo certo.'
      }));
    } catch (error) {
      setMessages(current => [...current, {
        id: uid(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Não consegui aplicar essa proposta com segurança.',
        error: true
      }]);
    } finally {
      setApplyingId('');
    }
  }

  function cancelProposal(messageId) {
    setMessages(current => current.map(item => item.id === messageId ? { ...item, proposal: null, cancelled: true } : item));
  }

  return <div className={`admin-nyan ${open ? 'is-open' : ''}`}>
    <section className="admin-nyan-panel" aria-label="Nyan, assistente administrativa" aria-hidden={!open}>
      <header className="admin-nyan-header">
        <div className="admin-nyan-identity">
          <NyanOrb className="admin-nyan-orb" active={sending} />
          <div><strong>Nyan</strong><span><i /> Assistente do painel</span></div>
        </div>
        <button type="button" className="admin-nyan-icon-button" onClick={() => setOpen(false)} aria-label="Fechar Nyan"><CloseIcon /></button>
      </header>

      <div ref={listRef} className="admin-nyan-messages" aria-live="polite">
        {messages.map(message => <article key={message.id} className={`admin-nyan-message is-${message.role}${message.error ? ' is-error' : ''}`}>
          <div className="admin-nyan-bubble">{linkify(message.content)}</div>
          {message.proposal ? <div className="admin-nyan-proposal">
            <span>Proposta</span>
            <strong>{message.proposal.summary}</strong>
            <small>Nada será alterado sem sua confirmação.</small>
            <div>
              <button type="button" className="button button-primary button-small" disabled={Boolean(applyingId)} onClick={() => apply(message)}>{applyingId === message.id ? 'Aplicando…' : 'Aplicar no painel'}</button>
              <button type="button" className="button button-quiet button-small" disabled={Boolean(applyingId)} onClick={() => cancelProposal(message.id)}>Cancelar</button>
            </div>
          </div> : null}
          {message.applied ? <small className="admin-nyan-state is-success">Proposta aplicada</small> : null}
          {message.cancelled ? <small className="admin-nyan-state">Proposta cancelada</small> : null}
        </article>)}
        {sending ? <div className="admin-nyan-thinking" role="status"><span /><span /><span /><em>Nyan está preparando a proposta…</em></div> : null}
      </div>

      <div className="admin-nyan-suggestions" aria-label="Sugestões">
        <button type="button" onClick={() => setInput('Adicione uma nova experiência profissional')}>Nova experiência</button>
        <button type="button" onClick={() => setInput('Importe um projeto do meu GitHub')}>Projeto do GitHub</button>
        <button type="button" onClick={() => setInput('Ajude a melhorar uma descrição do portfólio')}>Melhorar texto</button>
      </div>

      <form className="admin-nyan-composer" onSubmit={event => { event.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="admin-nyan-input">Pedido para a Nyan</label>
        <textarea id="admin-nyan-input" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
        }} rows="1" maxLength="1200" placeholder="Peça uma alteração no painel…" disabled={sending} />
        <button type="submit" disabled={sending || input.trim().length < 2} aria-label="Enviar pedido"><SendIcon /></button>
      </form>
    </section>

    <div className="admin-nyan-launcher-wrap">
      <span aria-hidden="true">Nyan do painel</span>
      <button type="button" className="admin-nyan-launcher" onClick={() => setOpen(value => !value)} aria-label={open ? 'Fechar Nyan administrativa' : 'Abrir Nyan administrativa'} aria-expanded={open}>
        <NyanOrb className="admin-nyan-launcher-orb" active={sending} interactive />
        <span className="admin-nyan-launcher-close" aria-hidden="true"><CloseIcon /></span>
      </button>
    </div>
  </div>;
}

export function renderAdminAssistant(container, options) {
  if (!container) return null;
  const root = createRoot(container);
  root.render(<AdminAssistant {...options} />);
  return root;
}
