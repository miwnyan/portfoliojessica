import {
  DEFAULT_PORTFOLIO,
  ICON_CATALOG,
  cloneDefaultPortfolio
} from '../js/default-data.js';
import {
  firebaseConfigured,
  watchAuth,
  signInAdmin,
  signOutAdmin,
  isCurrentUserAdmin,
  loadPortfolio,
  seedPortfolio,
  savePortfolio
} from '../js/data-service.js';
import {
  uploadMedia,
  validateMediaFile,
  MAX_UPLOAD_BYTES
} from '../js/media-service.js';
import { importGitHubRepository, parseGitHubRepository } from '../js/github-service.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  boot: $('#boot-view'),
  login: $('#login-view'),
  setup: $('#setup-view'),
  loginForm: $('#login-form'),
  loginEmail: $('#login-email'),
  loginPassword: $('#login-password'),
  loginSubmit: $('#login-submit'),
  loginError: $('#login-error'),
  togglePassword: $('#toggle-password'),
  skipLink: $('#admin-skip-link'),
  app: $('#admin-app'),
  workspace: $('.admin-workspace'),
  sidebar: $('#admin-sidebar'),
  sidebarScrim: $('#sidebar-scrim'),
  openSidebar: $('#open-sidebar'),
  closeSidebar: $('#close-sidebar'),
  nav: $('#admin-nav'),
  userEmail: $('#user-email'),
  logoutButton: $('#logout-button'),
  sectionContext: $('#section-context'),
  sectionTitle: $('#section-title'),
  content: $('#section-content'),
  saveButton: $('#save-button'),
  saveState: $('#save-state'),
  globalStatus: $('#global-status'),
  entityDialog: $('#entity-dialog'),
  entityForm: $('#entity-form'),
  entityFields: $('#entity-form-fields'),
  entityTitle: $('#entity-dialog-title'),
  entityKicker: $('#entity-dialog-kicker'),
  entitySubmit: $('#entity-submit'),
  githubDialog: $('#github-dialog'),
  githubForm: $('#github-form'),
  githubRepository: $('#github-repository'),
  githubDescription: $('#github-description'),
  githubDescriptionField: $('#github-description-field'),
  githubPreview: $('#github-preview'),
  githubError: $('#github-error'),
  githubSubmit: $('#github-submit'),
  confirmDialog: $('#confirm-dialog'),
  confirmTitle: $('#confirm-title'),
  confirmMessage: $('#confirm-message'),
  confirmAccept: $('#confirm-accept'),
  confirmCancel: $('#confirm-cancel'),
  toastRegion: $('#toast-region'),
  assistantRoot: $('#admin-assistant-root')
};

const SECTION_META = {
  overview: { context: 'Painel', title: 'Visão geral' },
  page: { context: 'Conteúdo', title: 'Textos da página' },
  projects: { context: 'Conteúdo', title: 'Projetos' },
  experiences: { context: 'Conteúdo', title: 'Experiência' },
  folders: { context: 'Conteúdo', title: 'Pastas e habilidades' },
  contact: { context: 'Conteúdo', title: 'Contato e links' },
  appearance: { context: 'Identidade', title: 'Aparência e mídia' }
};

const state = {
  user: null,
  portfolio: null,
  savedSignature: '',
  section: 'overview',
  saving: false,
  authBusy: false,
  initialized: false,
  authRevision: 0,
  authNotice: '',
  editing: null,
  githubCandidate: null,
  githubController: null,
  confirmResolve: null,
  drag: null,
  uploadControllers: new Map(),
  assistantRenderer: null
};

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(base, incoming) {
  if (Array.isArray(base)) return Array.isArray(incoming) ? deepClone(incoming) : deepClone(base);
  if (!isPlainObject(base)) return incoming === undefined ? base : incoming;

  const result = {};
  const source = isPlainObject(incoming) ? incoming : {};
  const keys = new Set([...Object.keys(base), ...Object.keys(source)]);
  keys.forEach(key => {
    if (Array.isArray(base[key])) {
      result[key] = Array.isArray(source[key]) ? deepClone(source[key]) : deepClone(base[key]);
    } else if (isPlainObject(base[key])) {
      result[key] = mergeDefaults(base[key], source[key]);
    } else {
      result[key] = source[key] === undefined ? base[key] : source[key];
    }
  });
  return result;
}

function normalizePortfolio(value) {
  const merged = mergeDefaults(cloneDefaultPortfolio(), value || {});
  merged.schemaVersion = Number(merged.schemaVersion || DEFAULT_PORTFOLIO.schemaVersion || 1);
  ['projects', 'experiences', 'folders', 'skills', 'contacts'].forEach(key => {
    const items = Array.isArray(merged[key]) ? merged[key] : [];
    merged[key] = items.map((item, index) => ({
      ...item,
      id: item?.id || createId(key.slice(0, -1)),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
      visible: item?.visible !== false
    }));
  });
  return merged;
}

function signature(value) {
  return JSON.stringify(value);
}

function createId(prefix = 'item') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHTML(value).replaceAll('`', '&#096;');
}

function getPath(object, path, fallback = '') {
  const value = String(path).split('.').reduce((current, key) => current?.[key], object);
  return value ?? fallback;
}

function setPath(object, path, value) {
  const keys = String(path).split('.');
  const finalKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!isPlainObject(current[key])) current[key] = {};
    return current[key];
  }, object);
  target[finalKey] = value;
}

function sorted(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function normalizeOrder(items, filter = () => true) {
  sorted(items.filter(filter)).forEach((item, index) => { item.order = index; });
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(value >= 10 * 1024 ** 2 ? 0 : 1)} MB`;
}

function valueOr(value, fallback = '') {
  return value === null || value === undefined ? fallback : value;
}

function markDirty(announcement = '') {
  updateSaveState();
  if (announcement) announce(announcement);
}

function isDirty() {
  return Boolean(state.portfolio) && signature(state.portfolio) !== state.savedSignature;
}

function updateSaveState(status) {
  if (!elements.saveState || !elements.saveButton) return;
  let stateName = status;
  let label;
  if (!stateName) stateName = state.saving ? 'saving' : (isDirty() ? 'dirty' : 'saved');

  if (stateName === 'saving') label = 'Salvando…';
  else if (stateName === 'dirty') label = 'Alterações não salvas';
  else if (stateName === 'error') label = 'Falha ao salvar';
  else label = 'Tudo salvo';

  elements.saveState.dataset.state = stateName;
  elements.saveState.textContent = label;
  elements.saveButton.disabled = state.saving || !isDirty();
}

function announce(message) {
  elements.globalStatus.textContent = '';
  window.setTimeout(() => { elements.globalStatus.textContent = message; }, 20);
}

function toast(message, type = 'info', timeout = 4200) {
  const item = document.createElement('div');
  item.className = `toast is-${type}`;
  item.innerHTML = `<p>${escapeHTML(message)}</p><button type="button" aria-label="Fechar aviso">×</button>`;
  const close = () => item.remove();
  $('button', item).addEventListener('click', close);
  elements.toastRegion.appendChild(item);
  if (timeout) window.setTimeout(close, timeout);
}

function friendlyError(error, fallback = 'Não foi possível concluir a ação.') {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const authMessages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique a internet e tente novamente.'
  };
  if (authMessages[code]) return authMessages[code];
  if (code === 'admin/access-check-failed') {
    return `${message} Atualize a página; se persistir, confira se o frontend foi recompilado com o projeto Firebase correto.`;
  }
  if (/not.?found|404/i.test(message)) return 'Repositório não encontrado. Confirme a URL e verifique se ele é público.';
  if (/rate|403/i.test(message)) return 'O GitHub limitou novas consultas por alguns minutos. Tente novamente em breve.';
  if (/network|fetch|offline/i.test(message)) return 'Falha de conexão. Verifique a internet e tente novamente.';
  return message && message.length < 190 ? message : fallback;
}

function showOnly(view) {
  elements.boot.hidden = view !== 'boot';
  elements.login.hidden = view !== 'login';
  elements.setup.hidden = view !== 'setup';
  elements.app.hidden = view !== 'app';
  elements.skipLink.hidden = view !== 'app';
}

function configured() {
  return typeof firebaseConfigured === 'function' ? Boolean(firebaseConfigured()) : Boolean(firebaseConfigured);
}

const sidebarMedia = window.matchMedia('(max-width: 920px)');

function syncSidebarAccessibility() {
  const mobile = sidebarMedia.matches;
  const open = mobile && elements.app.classList.contains('is-sidebar-open');
  elements.sidebar.toggleAttribute('inert', mobile && !open);
  if (mobile && !open) elements.sidebar.setAttribute('aria-hidden', 'true');
  else elements.sidebar.removeAttribute('aria-hidden');
  elements.workspace?.toggleAttribute('inert', open);
}

function openSidebar() {
  elements.app.classList.add('is-sidebar-open');
  elements.openSidebar.setAttribute('aria-expanded', 'true');
  syncSidebarAccessibility();
  elements.closeSidebar.focus();
}

function closeSidebar({ restoreFocus = false } = {}) {
  const wasOpen = elements.app.classList.contains('is-sidebar-open');
  elements.app.classList.remove('is-sidebar-open');
  elements.openSidebar.setAttribute('aria-expanded', 'false');
  syncSidebarAccessibility();
  if (restoreFocus && wasOpen) elements.openSidebar.focus();
}

function inputField({ path, name, label, value, type = 'text', help = '', required = false, span = '', min, max, step, placeholder = '', maxlength, pattern, inputmode }) {
  const fieldName = name || path;
  const dataPath = path ? ` data-setting-path="${escapeAttribute(path)}"` : '';
  const attrs = [
    `name="${escapeAttribute(fieldName)}"`,
    `type="${escapeAttribute(type)}"`,
    `value="${escapeAttribute(valueOr(value))}"`,
    required ? 'required' : '',
    min !== undefined ? `min="${escapeAttribute(min)}"` : '',
    max !== undefined ? `max="${escapeAttribute(max)}"` : '',
    step !== undefined ? `step="${escapeAttribute(step)}"` : '',
    maxlength !== undefined ? `maxlength="${escapeAttribute(maxlength)}"` : '',
    pattern ? `pattern="${escapeAttribute(pattern)}"` : '',
    inputmode ? `inputmode="${escapeAttribute(inputmode)}"` : '',
    placeholder ? `placeholder="${escapeAttribute(placeholder)}"` : '',
    dataPath
  ].filter(Boolean).join(' ');
  return `<div class="field ${span}"><label>${escapeHTML(label)}<input ${attrs}></label>${help ? `<small>${escapeHTML(help)}</small>` : ''}</div>`;
}

function textareaField({ path, name, label, value, help = '', required = false, span = '', rows = 4, maxlength, arrayLines = false }) {
  const fieldName = name || path;
  const pathAttr = path ? ` data-setting-path="${escapeAttribute(path)}"` : '';
  const arrayAttr = arrayLines ? ' data-array-lines="true"' : '';
  const lengthAttr = maxlength ? ` maxlength="${Number(maxlength)}"` : '';
  return `<div class="field ${span}"><label>${escapeHTML(label)}<textarea name="${escapeAttribute(fieldName)}" rows="${rows}"${required ? ' required' : ''}${lengthAttr}${pathAttr}${arrayAttr}>${escapeHTML(Array.isArray(value) ? value.join('\n') : valueOr(value))}</textarea></label>${help ? `<small>${escapeHTML(help)}</small>` : ''}</div>`;
}

function checkboxField({ path, name, label, checked, help = '', span = '' }) {
  const fieldName = name || path;
  const pathAttr = path ? ` data-setting-path="${escapeAttribute(path)}"` : '';
  return `<div class="field ${span}"><label class="checkbox-field"><input name="${escapeAttribute(fieldName)}" type="checkbox"${checked ? ' checked' : ''}${pathAttr}><span><strong>${escapeHTML(label)}</strong>${help ? `<small>${escapeHTML(help)}</small>` : ''}</span></label></div>`;
}

function selectField({ path, name, label, value, options, help = '', required = false, span = '' }) {
  const fieldName = name || path;
  const pathAttr = path ? ` data-setting-path="${escapeAttribute(path)}"` : '';
  const choices = options.map(option => {
    const optionValue = typeof option === 'string' ? option : option.value;
    const optionLabel = typeof option === 'string' ? option : option.label;
    return `<option value="${escapeAttribute(optionValue)}"${String(optionValue) === String(value) ? ' selected' : ''}>${escapeHTML(optionLabel)}</option>`;
  }).join('');
  return `<div class="field ${span}"><label>${escapeHTML(label)}<select name="${escapeAttribute(fieldName)}"${required ? ' required' : ''}${pathAttr}>${choices}</select></label>${help ? `<small>${escapeHTML(help)}</small>` : ''}</div>`;
}

function colorField(path, label) {
  const value = getPath(state.portfolio, path, '#000000');
  return `<div class="field"><label>${escapeHTML(label)}</label><div class="color-field"><input type="color" value="${escapeAttribute(value)}" data-color-for="${escapeAttribute(path)}" aria-label="Selecionar ${escapeAttribute(label)}"><input type="text" value="${escapeAttribute(value)}" data-setting-path="${escapeAttribute(path)}" data-color-text="${escapeAttribute(path)}" pattern="#[0-9a-fA-F]{6}" maxlength="7" aria-label="Código hexadecimal de ${escapeAttribute(label)}"></div></div>`;
}

function panel(title, description, body, id = '') {
  return `<section class="editor-panel"${id ? ` id="${escapeAttribute(id)}"` : ''}><header class="editor-panel-header"><div><h3>${escapeHTML(title)}</h3>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div></header><div class="editor-panel-body">${body}</div></section>`;
}

function pageHeading(title, description, actions = '') {
  return `<header class="page-heading"><div class="page-heading-copy"><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>${actions ? `<div class="page-heading-actions">${actions}</div>` : ''}</header>`;
}

function render() {
  if (!state.portfolio) return;
  const meta = SECTION_META[state.section] || SECTION_META.overview;
  elements.sectionContext.textContent = meta.context;
  elements.sectionTitle.textContent = meta.title;
  $$('.admin-nav-item', elements.nav).forEach(button => {
    const active = button.dataset.section === state.section;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const renderers = {
    overview: renderOverview,
    page: renderPageSettings,
    projects: renderProjects,
    experiences: renderExperiences,
    folders: renderFolders,
    contact: renderContact,
    appearance: renderAppearance
  };
  elements.content.innerHTML = (renderers[state.section] || renderOverview)();
  updateSaveState();
}

function renderOverview() {
  const visibleCount = key => state.portfolio[key].filter(item => item.visible !== false).length;
  const bunny = state.portfolio.settings.about.bunnyStaticUrl || '../assets/coelhinho-estatico.png';
  return `
    <section class="overview-hero">
      <div>
        <h2>Seu portfólio, organizado em um só lugar.</h2>
        <p>Edite conteúdo, reorganize seções e atualize imagens sem mexer no código. As mudanças só chegam ao site quando você salvar.</p>
      </div>
      <img src="${escapeAttribute(bunny)}" alt="" width="160" height="160">
    </section>
    <div class="overview-grid" aria-label="Resumo do conteúdo">
      <article class="metric-card"><strong>${visibleCount('projects')}</strong><span>projetos publicados</span></article>
      <article class="metric-card"><strong>${visibleCount('experiences')}</strong><span>experiências visíveis</span></article>
      <article class="metric-card"><strong>${visibleCount('folders')}</strong><span>pastas ativas</span></article>
      <article class="metric-card"><strong>${visibleCount('skills')}</strong><span>habilidades exibidas</span></article>
    </div>
    <section class="quick-panel">
      <h3>Ações rápidas</h3>
      <div class="quick-actions">
        <button class="button button-quiet quick-action" type="button" data-action="new-project">Adicionar projeto manual</button>
        <button class="button button-quiet quick-action" type="button" data-action="github-import">Importar do GitHub</button>
        <button class="button button-quiet quick-action" type="button" data-action="new-experience">Adicionar experiência</button>
      </div>
    </section>`;
}

function renderPageSettings() {
  const settings = state.portfolio.settings;
  const navigation = panel('Navegação', 'Rótulos exibidos no menu principal.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.navigation.home', label: 'Início', value: settings.navigation.home })}
      ${inputField({ path: 'settings.navigation.about', label: 'Sobre', value: settings.navigation.about })}
      ${inputField({ path: 'settings.navigation.projects', label: 'Projetos', value: settings.navigation.projects })}
      ${inputField({ path: 'settings.navigation.contact', label: 'Contato', value: settings.navigation.contact })}
    </div>`);

  const hero = panel('Apresentação', 'Primeiro conteúdo visto ao abrir o portfólio.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.hero.eyebrow', label: 'Selo superior', value: settings.hero.eyebrow })}
      ${inputField({ path: 'settings.hero.intro', label: 'Início do título', value: settings.hero.intro })}
      ${inputField({ path: 'settings.hero.name', label: 'Nome em destaque', value: settings.hero.name })}
      ${textareaField({ path: 'settings.hero.description', label: 'Descrição', value: settings.hero.description, span: 'field-span-2', maxlength: 500 })}
      ${inputField({ path: 'settings.hero.primaryLabel', label: 'Botão principal', value: settings.hero.primaryLabel })}
      ${inputField({ path: 'settings.hero.secondaryLabel', label: 'Botão secundário', value: settings.hero.secondaryLabel })}
    </div>`);

  const about = panel('Sobre', 'Apresentação pessoal e texto alternativo do coelhinho.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.about.title', label: 'Título', value: settings.about.title })}
      ${inputField({ path: 'settings.about.bunnyAlt', label: 'Descrição acessível do coelhinho', value: settings.about.bunnyAlt })}
      ${textareaField({ path: 'settings.about.paragraphs', label: 'Parágrafos', value: settings.about.paragraphs, help: 'Use uma linha para cada parágrafo.', span: 'field-span-2', rows: 7, arrayLines: true })}
    </div>`);

  const sections = panel('Títulos das seções', 'Textos que organizam as áreas do portfólio.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.sections.skillsTitle', label: 'Habilidades', value: settings.sections.skillsTitle })}
      ${inputField({ path: 'settings.sections.experienceTitle', label: 'Experiência', value: settings.sections.experienceTitle })}
      ${textareaField({ path: 'settings.sections.skillsIntro', label: 'Introdução das habilidades', value: settings.sections.skillsIntro, span: 'field-span-2', rows: 3 })}
      ${inputField({ path: 'settings.sections.projectsTitle', label: 'Projetos', value: settings.sections.projectsTitle })}
      ${inputField({ path: 'settings.sections.contactTitle', label: 'Contato', value: settings.sections.contactTitle })}
      ${inputField({ path: 'settings.sections.projectsIntro', label: 'Introdução dos projetos', value: settings.sections.projectsIntro, span: 'field-span-2' })}
    </div>`);

  const footer = panel('Rodapé', 'Identidade e créditos exibidos no final da página.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.footer.name', label: 'Nome', value: settings.footer.name })}
      ${inputField({ path: 'settings.footer.copyrightName', label: 'Nome no copyright', value: settings.footer.copyrightName })}
      ${inputField({ path: 'settings.footer.tagline', label: 'Descrição', value: settings.footer.tagline, span: 'field-span-2' })}
      ${inputField({ path: 'settings.footer.backLabel', label: 'Link de retorno', value: settings.footer.backLabel })}
      ${inputField({ path: 'settings.footer.credit', label: 'Crédito', value: settings.footer.credit })}
    </div>`);

  const ui = settings.ui;
  const interfaceTexts = panel('Textos de interface', 'Rótulos de botões, menus, pastas, modais e mensagens.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.ui.skipToContentLabel', label: 'Pular para conteúdo', value: ui.skipToContentLabel })}
      ${inputField({ path: 'settings.ui.menuOpenLabel', label: 'Abrir menu', value: ui.menuOpenLabel })}
      ${inputField({ path: 'settings.ui.menuCloseLabel', label: 'Fechar menu', value: ui.menuCloseLabel })}
      ${inputField({ path: 'settings.ui.folderOpenLabel', label: 'Abrir pasta', value: ui.folderOpenLabel })}
      ${inputField({ path: 'settings.ui.folderCloseLabel', label: 'Fechar pasta', value: ui.folderCloseLabel })}
      ${inputField({ path: 'settings.ui.folderMoreLabel', label: 'Ver mais itens', value: ui.folderMoreLabel })}
      ${inputField({ path: 'settings.ui.folderLessLabel', label: 'Ver menos itens', value: ui.folderLessLabel })}
      ${inputField({ path: 'settings.ui.experienceExpandLabel', label: 'Expandir experiências', value: ui.experienceExpandLabel })}
      ${inputField({ path: 'settings.ui.experienceCollapseLabel', label: 'Recolher experiências', value: ui.experienceCollapseLabel })}
      ${inputField({ path: 'settings.ui.experienceCollapsedCount', label: 'Experiências antes de expandir', value: ui.experienceCollapsedCount, type: 'number', min: 1, max: 12, step: 1, required: true })}
      ${inputField({ path: 'settings.ui.projectDetailsLabel', label: 'Detalhes do projeto', value: ui.projectDetailsLabel })}
      ${inputField({ path: 'settings.ui.projectRepositoryLabel', label: 'Botão do repositório', value: ui.projectRepositoryLabel })}
      ${inputField({ path: 'settings.ui.projectRepositoryTitle', label: 'Título do link do repositório', value: ui.projectRepositoryTitle })}
      ${inputField({ path: 'settings.ui.projectHomepageLabel', label: 'Botão do projeto publicado', value: ui.projectHomepageLabel || 'Visitar projeto' })}
      ${inputField({ path: 'settings.ui.projectHomepageTitle', label: 'Título do link publicado', value: ui.projectHomepageTitle || 'Abrir projeto publicado' })}
      ${inputField({ path: 'settings.ui.skillDialogCloseLabel', label: 'Fechar habilidade', value: ui.skillDialogCloseLabel })}
      ${inputField({ path: 'settings.ui.projectDialogCloseLabel', label: 'Fechar projeto', value: ui.projectDialogCloseLabel })}
    </div>`);

  return `${pageHeading('Textos da página', 'Altere a comunicação do portfólio sem modificar sua estrutura visual.')}<div class="editor-stack">${navigation}${hero}${about}${sections}${footer}${interfaceTexts}</div>`;
}

function visibilityBadge(item) {
  return item.visible === false
    ? '<span class="badge badge-muted">Oculto</span>'
    : '<span class="badge badge-success">Visível</span>';
}

function rowActions(type, item, index, total, extra = '') {
  return `<div class="row-actions">
    <div class="reorder-actions" aria-label="Reordenar">
      <button class="icon-button" type="button" data-action="move" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id)}" data-direction="-1" aria-label="Mover para cima"${index === 0 ? ' disabled' : ''}>↑</button>
      <button class="icon-button" type="button" data-action="move" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id)}" data-direction="1" aria-label="Mover para baixo"${index === total - 1 ? ' disabled' : ''}>↓</button>
    </div>
    ${extra}
    <button class="icon-button" type="button" data-action="toggle-visible" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id)}" aria-label="${item.visible === false ? 'Exibir' : 'Ocultar'} ${escapeAttribute(item.name || item.title || item.label || 'item')}">${item.visible === false ? '◉' : '◌'}</button>
    <button class="icon-button" type="button" data-action="edit" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id)}" aria-label="Editar ${escapeAttribute(item.name || item.title || item.label || 'item')}">✎</button>
    <button class="icon-button is-danger" type="button" data-action="delete" data-type="${escapeAttribute(type)}" data-id="${escapeAttribute(item.id)}" aria-label="Excluir ${escapeAttribute(item.name || item.title || item.label || 'item')}">×</button>
  </div>`;
}

function emptyState(symbol, title, description, action, label) {
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">${escapeHTML(symbol)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p><button class="button button-primary" type="button" data-action="${escapeAttribute(action)}">${escapeHTML(label)}</button></div>`;
}

function renderProjects() {
  const projects = sorted(state.portfolio.projects);
  const actions = `
    <button class="button button-outline" type="button" data-action="github-import">Importar do GitHub</button>
    <button class="button button-primary" type="button" data-action="new-project">Adicionar manualmente</button>`;

  const list = projects.length ? `<div class="entity-list" data-sort-list="projects">
    ${projects.map((project, index) => {
      const technologies = Array.isArray(project.technologies) ? project.technologies : [];
      const cover = project.coverUrl || '';
      return `<article class="entity-row${project.visible === false ? ' is-hidden' : ''}" draggable="true" data-type="project" data-id="${escapeAttribute(project.id)}">
        <button class="drag-handle" type="button" aria-label="Arrastar ${escapeAttribute(project.name)} para reordenar" title="Arraste para reordenar">⠿</button>
        <div class="row-thumbnail">${cover ? `<img src="${escapeAttribute(cover)}" alt="">` : '<span class="row-icon-placeholder">◇</span>'}</div>
        <div class="row-main">
          <div class="row-title-line"><h3>${escapeHTML(project.name || 'Projeto sem nome')}</h3>${visibilityBadge(project)}<span class="badge">${project.source === 'github' ? 'GitHub' : 'Manual'}</span></div>
          <p>${escapeHTML(project.summary || project.description || 'Sem descrição.')}</p>
          <div class="row-meta"><span>${technologies.length} tecnologia${technologies.length === 1 ? '' : 's'}</span>${project.repositoryUrl ? `<span>${escapeHTML(project.repositoryUrl.replace(/^https?:\/\//, ''))}</span>` : ''}</div>
        </div>
        ${rowActions('project', project, index, projects.length)}
      </article>`;
    }).join('')}
  </div>` : emptyState('◇', 'Nenhum projeto ainda', 'Adicione manualmente ou importe um repositório público do GitHub.', 'new-project', 'Adicionar projeto');

  return `${pageHeading('Projetos', 'Edite os projetos atuais, altere a ordem ou publique um novo trabalho.', actions)}
    <div class="toolbar"><div class="toolbar-search"><label class="sr-only" for="project-search">Buscar projetos</label><input id="project-search" class="search-input" type="search" placeholder="Buscar projeto" data-filter-rows="project"></div><span class="toolbar-meta">${projects.length} projeto${projects.length === 1 ? '' : 's'}</span></div>${list}`;
}

function renderExperiences() {
  const experiences = sorted(state.portfolio.experiences);
  const actions = '<button class="button button-primary" type="button" data-action="new-experience">Adicionar experiência</button>';
  const list = experiences.length ? `<div class="entity-list" data-sort-list="experiences">
    ${experiences.map((experience, index) => `<article class="entity-row${experience.visible === false ? ' is-hidden' : ''}" draggable="true" data-type="experience" data-id="${escapeAttribute(experience.id)}">
      <button class="drag-handle" type="button" aria-label="Arrastar ${escapeAttribute(experience.title)} para reordenar" title="Arraste para reordenar">⠿</button>
      <div class="row-icon"><span class="row-icon-placeholder">${escapeHTML(experience.period || '—')}</span></div>
      <div class="row-main">
        <div class="row-title-line"><h3>${escapeHTML(experience.title || 'Experiência sem título')}</h3>${visibilityBadge(experience)}</div>
        <p>${escapeHTML(experience.institution || 'Instituição não informada')}</p>
        <div class="row-meta"><span>${escapeHTML(experience.period || 'Período não informado')}</span></div>
      </div>
      ${rowActions('experience', experience, index, experiences.length)}
    </article>`).join('')}
  </div>` : emptyState('◷', 'Nenhuma experiência ainda', 'Inclua formações, trabalhos, certificações e participações importantes.', 'new-experience', 'Adicionar experiência');

  return `${pageHeading('Experiência', 'A ordem abaixo é a mesma exibida na linha do tempo pública.', actions)}
    <div class="notice-panel"><span aria-hidden="true">↕</span><p>Arraste os itens ou use as setas. No site, os primeiros <strong>${escapeHTML(state.portfolio.settings.ui.experienceCollapsedCount)}</strong> aparecem antes do botão de expansão.</p></div>${list}`;
}

function iconForSkill(skill) {
  const catalogIcon = ICON_CATALOG.find(icon => icon.id === skill.iconId);
  return skill.iconUrl || catalogIcon?.url || '/assets/icons/code.svg';
}

function renderFolders() {
  const folders = sorted(state.portfolio.folders);
  const actions = '<button class="button button-primary" type="button" data-action="new-folder">Criar pasta</button>';
  if (!folders.length) {
    return `${pageHeading('Pastas e habilidades', 'Organize as tecnologias em pastas que mantêm o visual característico do site.', actions)}${emptyState('▰', 'Nenhuma pasta ainda', 'Crie uma pasta para começar a organizar suas habilidades.', 'new-folder', 'Criar pasta')}`;
  }

  const groups = folders.map((folder, folderIndex) => {
    const skills = sorted(state.portfolio.skills.filter(skill => skill.folderId === folder.id));
    const skillList = skills.length ? skills.map((skill, index) => `<article class="entity-row${skill.visible === false ? ' is-hidden' : ''}" draggable="true" data-type="skill" data-id="${escapeAttribute(skill.id)}" data-parent="${escapeAttribute(folder.id)}">
      <button class="drag-handle" type="button" aria-label="Arrastar ${escapeAttribute(skill.name)} para reordenar" title="Arraste para reordenar">⠿</button>
      <div class="row-icon"><img src="${escapeAttribute(iconForSkill(skill))}" alt=""></div>
      <div class="row-main">
        <div class="row-title-line"><h3>${escapeHTML(skill.name || 'Habilidade sem nome')}</h3>${visibilityBadge(skill)}${skill.badge ? `<span class="badge badge-warning">${escapeHTML(skill.badge)}</span>` : ''}</div>
        <p>${escapeHTML(skill.status || skill.description || 'Sem descrição.')}</p>
      </div>
      ${rowActions('skill', skill, index, skills.length)}
    </article>`).join('') : `<div class="empty-state"><p>Esta pasta ainda não tem habilidades.</p><button class="button button-outline button-small" type="button" data-action="new-skill" data-folder-id="${escapeAttribute(folder.id)}">Adicionar habilidade</button></div>`;

    const folderExtra = `<button class="icon-button" type="button" data-action="new-skill" data-folder-id="${escapeAttribute(folder.id)}" aria-label="Adicionar habilidade em ${escapeAttribute(folder.name)}">＋</button>`;
    return `<section class="folder-group${folder.visible === false ? ' is-hidden' : ''}" draggable="true" data-type="folder" data-id="${escapeAttribute(folder.id)}">
      <header class="folder-group-header">
        <button class="drag-handle" type="button" aria-label="Arrastar pasta ${escapeAttribute(folder.name)} para reordenar" title="Arraste para reordenar">⠿</button>
        <span class="folder-color" style="background:${escapeAttribute(folder.color || '#d991ba')}" aria-hidden="true"></span>
        <div><div class="row-title-line"><h3>${escapeHTML(folder.name || 'Pasta sem nome')}</h3>${visibilityBadge(folder)}</div><p>${skills.length} habilidade${skills.length === 1 ? '' : 's'} · ${folder.openByDefault ? 'abre expandida' : 'abre fechada'}</p></div>
        ${rowActions('folder', folder, folderIndex, folders.length, folderExtra)}
      </header>
      <div class="folder-skills-list" data-sort-list="skills" data-parent="${escapeAttribute(folder.id)}">${skillList}</div>
    </section>`;
  }).join('');

  return `${pageHeading('Pastas e habilidades', 'Edite as pastas, escolha ícones e reorganize cada habilidade.', actions)}
    <div class="notice-panel"><span aria-hidden="true">i</span><p>Até seis habilidades mantêm a pasta no tamanho original. Com mais itens, o site adiciona o controle <strong>Ver mais</strong> para preservar o layout.</p></div>${groups}`;
}

function renderContact() {
  const contact = state.portfolio.settings.contact;
  const settingsPanel = panel('Área de contato', 'Textos do formulário e do bloco sobre o trabalho.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.contact.formTitle', label: 'Título do formulário', value: contact.formTitle })}
      <div class="field field-span-2"><span class="field-label">Entrega do formulário</span><p class="field-help">As mensagens são entregues pelo webhook privado da publicação sem expor a credencial no navegador.</p></div>
      ${inputField({ path: 'settings.contact.nameLabel', label: 'Campo de nome', value: contact.nameLabel })}
      ${inputField({ path: 'settings.contact.emailLabel', label: 'Campo de e-mail', value: contact.emailLabel })}
      ${inputField({ path: 'settings.contact.messageLabel', label: 'Campo de mensagem', value: contact.messageLabel })}
      ${inputField({ path: 'settings.contact.submitLabel', label: 'Botão de envio', value: contact.submitLabel })}
      ${inputField({ path: 'settings.contact.infoTitle', label: 'Título sobre o trabalho', value: contact.infoTitle })}
      ${inputField({ path: 'settings.contact.socialTitle', label: 'Título das redes', value: contact.socialTitle })}
      ${textareaField({ path: 'settings.contact.infoText', label: 'Descrição do trabalho', value: contact.infoText, span: 'field-span-2', rows: 3 })}
      ${textareaField({ path: 'settings.contact.services', label: 'Lista de serviços', value: contact.services, help: 'Use uma linha para cada item.', span: 'field-span-2', rows: 4, arrayLines: true })}
    </div>`);

  const contacts = sorted(state.portfolio.contacts);
  const list = contacts.length ? `<div class="entity-list" data-sort-list="contacts">${contacts.map((item, index) => {
    const icon = item.iconUrl || ICON_CATALOG.find(entry => entry.id === item.iconId)?.url || '/assets/icons/code.svg';
    return `<article class="entity-row contact-link-row${item.visible === false ? ' is-hidden' : ''}" draggable="true" data-type="contact" data-id="${escapeAttribute(item.id)}">
      <button class="drag-handle" type="button" aria-label="Arrastar ${escapeAttribute(item.label)} para reordenar" title="Arraste para reordenar">⠿</button>
      <div class="row-icon"><img src="${escapeAttribute(icon)}" alt=""></div>
      <div class="row-main"><div class="row-title-line"><h3>${escapeHTML(item.label || 'Contato sem nome')}</h3>${visibilityBadge(item)}</div><p>${escapeHTML(item.url || 'Link não informado')}</p></div>
      ${rowActions('contact', item, index, contacts.length)}
    </article>`;
  }).join('')}</div>` : emptyState('@', 'Nenhum método de contato', 'Adicione uma rede social, e-mail ou link para contato.', 'new-contact', 'Adicionar contato');

  const linksPanel = panel('Links e redes', 'A ordem define como os ícones aparecem no site.', `<div class="toolbar"><span class="toolbar-meta">${contacts.length} link${contacts.length === 1 ? '' : 's'}</span><button class="button button-primary button-small" type="button" data-action="new-contact">Adicionar link</button></div>${list}`);
  return `${pageHeading('Contato e links', 'Atualize o formulário, os serviços e os canais usados para falar com você.')}<div class="editor-stack">${settingsPanel}${linksPanel}</div>`;
}

function mediaCard({ title, description, url, path, kind, accept = 'image/*', favicon = false }) {
  const inputId = `upload-${path.replaceAll('.', '-')}`;
  return `<article class="media-card" data-media-card="${escapeAttribute(path)}">
    <div class="media-preview${favicon ? ' is-favicon' : ''}">${url ? `<img src="${escapeAttribute(url)}" alt="Prévia de ${escapeAttribute(title)}">` : '<span class="row-icon-placeholder">Sem imagem</span>'}</div>
    <div class="media-copy">
      <h4>${escapeHTML(title)}</h4>
      <p>${escapeHTML(description)} Limite: ${escapeHTML(formatBytes(MAX_UPLOAD_BYTES))}.</p>
      <div class="upload-actions">
        <input id="${escapeAttribute(inputId)}" class="file-input" type="file" accept="${escapeAttribute(accept)}" data-media-upload="${escapeAttribute(path)}" data-upload-kind="${escapeAttribute(kind)}">
        <button class="button button-outline button-small" type="button" data-file-target="${escapeAttribute(inputId)}">${url ? 'Trocar arquivo' : 'Enviar arquivo'}</button>
        ${url ? `<button class="button button-quiet button-small" type="button" data-action="reset-media" data-path="${escapeAttribute(path)}">Restaurar padrão</button>` : ''}
      </div>
      <div class="upload-progress" hidden><span></span></div>
      <p class="form-message form-message-error" role="alert" hidden></p>
    </div>
  </article>`;
}

function renderAppearance() {
  const { meta, about, theme } = state.portfolio.settings;
  const metaPanel = panel('SEO e navegador', 'Título, descrição, cor do navegador e compartilhamento.', `
    <div class="editor-grid">
      ${inputField({ path: 'settings.meta.title', label: 'Título da página', value: meta.title, maxlength: 70 })}
      ${inputField({ path: 'settings.meta.ogTitle', label: 'Título ao compartilhar', value: meta.ogTitle, maxlength: 80 })}
      ${textareaField({ path: 'settings.meta.description', label: 'Descrição para buscadores', value: meta.description, maxlength: 180, rows: 3 })}
      ${textareaField({ path: 'settings.meta.ogDescription', label: 'Descrição ao compartilhar', value: meta.ogDescription, maxlength: 200, rows: 3 })}
      ${colorField('settings.meta.themeColor', 'Cor do navegador')}
    </div>`);

  const themePanel = panel('Tema', 'Ajuste a paleta dentro dos mesmos papéis visuais usados pelo site.', `
    <div class="editor-grid is-three">
      ${colorField('settings.theme.bg', 'Fundo principal')}
      ${colorField('settings.theme.bgAlt', 'Fundo alternativo')}
      ${colorField('settings.theme.panel', 'Painéis')}
      ${colorField('settings.theme.panelDark', 'Painéis escuros')}
      ${colorField('settings.theme.border', 'Bordas')}
      ${colorField('settings.theme.borderSoft', 'Bordas suaves')}
      ${colorField('settings.theme.accent', 'Destaque')}
      ${colorField('settings.theme.accentLight', 'Destaque claro')}
      ${colorField('settings.theme.accentDeep', 'Destaque profundo')}
      ${colorField('settings.theme.text', 'Texto')}
      ${colorField('settings.theme.muted', 'Texto secundário')}
      ${inputField({ path: 'settings.theme.radius', label: 'Raio dos cantos', value: theme.radius, placeholder: '11px', pattern: '\\d+(?:\\.\\d+)?(?:px|rem|em|%)', inputmode: 'decimal', required: true, help: 'Use um número seguido de px, rem, em ou %, por exemplo 11px.' })}
      <div class="field-span-3"><div id="theme-preview" class="theme-preview" style="--preview-bg:${escapeAttribute(theme.bg)};--preview-panel:${escapeAttribute(theme.panel)};--preview-border:${escapeAttribute(theme.border)};--preview-accent:${escapeAttribute(theme.accent)};--preview-text:${escapeAttribute(theme.text)};--preview-muted:${escapeAttribute(theme.muted)};--preview-radius:${escapeAttribute(theme.radius)}"><div class="theme-preview-card"><h4>Prévia do tema</h4><p>Confira texto, painel, borda e destaque antes de salvar.</p><span class="theme-preview-accent">Ação principal</span></div></div></div>
      <div class="field-span-3"><button class="button button-quiet" type="button" data-action="reset-theme">Restaurar tema rosa original</button></div>
    </div>`);

  const mediaPanel = panel('Imagens do site', 'Envie GIF, PNG, WebP, JPG ou SVG. O arquivo fica hospedado na biblioteca de mídia.', `
    <div class="editor-stack">
      ${mediaCard({ title: 'Coelhinho animado', description: 'Aparece na seção Sobre para visitantes sem redução de movimento.', url: about.bunnyAnimatedUrl, path: 'settings.about.bunnyAnimatedUrl', kind: 'bunny' })}
      ${mediaCard({ title: 'Coelhinho estático', description: 'Alternativa acessível para quem prefere menos movimento.', url: about.bunnyStaticUrl, path: 'settings.about.bunnyStaticUrl', kind: 'bunny-static' })}
      ${mediaCard({ title: 'Favicon', description: 'Ícone exibido na aba do navegador.', url: meta.faviconUrl, path: 'settings.meta.faviconUrl', kind: 'favicon', accept: 'image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp,.ico', favicon: true })}
    </div>`);

  return `${pageHeading('Aparência e mídia', 'Personalize cores, metadados e imagens sem alterar o layout original.')}<div class="editor-stack">${metaPanel}${themePanel}${mediaPanel}</div>`;
}

const COLLECTION_FOR_TYPE = {
  project: 'projects',
  experience: 'experiences',
  folder: 'folders',
  skill: 'skills',
  contact: 'contacts'
};

const TYPE_LABEL = {
  project: 'projeto',
  experience: 'experiência',
  folder: 'pasta',
  skill: 'habilidade',
  contact: 'contato'
};

function nextOrder(collection, filter = () => true) {
  const values = collection.filter(filter).map(item => Number(item.order || 0));
  return values.length ? Math.max(...values) + 1 : 0;
}

function blankEntity(type, preset = {}) {
  if (type === 'project') return {
    id: createId('project'), order: nextOrder(state.portfolio.projects), visible: true,
    name: '', summary: '', description: '', technologies: [], coverUrl: '', coverPublicId: '', repositoryUrl: '', homepageUrl: '', source: 'manual', github: null,
    ...preset
  };
  if (type === 'experience') return {
    id: createId('experience'), order: nextOrder(state.portfolio.experiences), visible: true,
    period: '', startDate: '', endDate: '', title: '', institution: '', description: '',
    ...preset
  };
  if (type === 'folder') return {
    id: createId('folder'), order: nextOrder(state.portfolio.folders), visible: true,
    name: '', color: '#d991ba', colorDeep: '#8f5578', openByDefault: true,
    ...preset
  };
  if (type === 'skill') {
    const folderId = preset.folderId || sorted(state.portfolio.folders)[0]?.id || '';
    return {
      id: createId('skill'), folderId,
      order: nextOrder(state.portfolio.skills, item => item.folderId === folderId), visible: true,
      name: '', title: '', badge: '', status: '', iconId: 'code', iconUrl: ICON_CATALOG.find(item => item.id === 'code')?.url || '/assets/icons/code.svg',
      description: '', details: [], ...preset
    };
  }
  return {
    id: createId('contact'), order: nextOrder(state.portfolio.contacts), visible: true,
    type: 'external', label: '', url: '', iconId: 'mail', iconUrl: '', ariaLabel: '', title: '',
    ...preset
  };
}

function entityColorField(name, label, value) {
  return `<div class="field"><label>${escapeHTML(label)}</label><div class="color-field"><input type="color" value="${escapeAttribute(value)}" data-entity-color-for="${escapeAttribute(name)}" aria-label="Selecionar ${escapeAttribute(label)}"><input type="text" name="${escapeAttribute(name)}" value="${escapeAttribute(value)}" pattern="#[0-9a-fA-F]{6}" maxlength="7" required aria-label="Código hexadecimal de ${escapeAttribute(label)}"></div></div>`;
}

function dialogMediaField({ name, label, value, kind, help, accept = 'image/*' }) {
  const inputId = `dialog-upload-${name}`;
  return `<div class="field field-span-2 dialog-media-field" data-dialog-media-field="${escapeAttribute(name)}">
    <label>${escapeHTML(label)}</label>
    <div class="media-card">
      <div class="media-preview">${value ? `<img src="${escapeAttribute(value)}" alt="Prévia de ${escapeAttribute(label)}">` : '<span class="row-icon-placeholder">Sem imagem</span>'}</div>
      <div class="media-copy">
        <p>${escapeHTML(help || '')} Limite: ${escapeHTML(formatBytes(MAX_UPLOAD_BYTES))}.</p>
        <input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}">
        <input id="${escapeAttribute(inputId)}" class="file-input" type="file" accept="${escapeAttribute(accept)}" data-dialog-upload="${escapeAttribute(name)}" data-upload-kind="${escapeAttribute(kind)}">
        <div class="upload-actions"><button class="button button-outline button-small" type="button" data-file-target="${escapeAttribute(inputId)}">${value ? 'Trocar arquivo' : 'Enviar arquivo'}</button></div>
        <div class="upload-progress" hidden><span></span></div>
        <p class="form-message form-message-error" role="alert" hidden></p>
      </div>
    </div>
  </div>`;
}

function iconPicker(selectedId, selectedUrl, { contactsOnly = false } = {}) {
  const icons = ICON_CATALOG.filter(icon => !contactsOnly || ['contacts', 'generic', 'tools'].includes(icon.category));
  const customSelected = selectedId === 'custom' && Boolean(selectedUrl);
  return `<div class="field field-span-2 icon-picker">
    <label for="icon-search">Ícone</label>
    <input id="icon-search" class="search-input" type="search" placeholder="Buscar linguagem, ferramenta ou ícone" data-icon-search>
    <input type="hidden" name="iconId" value="${escapeAttribute(selectedId || 'code')}">
    <input type="hidden" name="iconUrl" value="${escapeAttribute(selectedUrl || '')}">
    <div class="icon-grid" role="listbox" aria-label="Escolher ícone">
      ${icons.map(icon => `<button class="icon-option${icon.id === selectedId ? ' is-selected' : ''}" type="button" role="option" aria-selected="${icon.id === selectedId}" data-icon-id="${escapeAttribute(icon.id)}" data-icon-url="${escapeAttribute(icon.url)}" data-icon-search-value="${escapeAttribute([icon.label, icon.category, ...(icon.keywords || [])].join(' ').toLowerCase())}"><img src="${escapeAttribute(icon.url)}" alt=""><span>${escapeHTML(icon.label)}</span></button>`).join('')}
    </div>
    <div class="custom-icon-preview" data-custom-icon-preview${customSelected ? '' : ' hidden'}>
      ${customSelected ? `<img src="${escapeAttribute(selectedUrl)}" alt=""><span>Ícone personalizado selecionado</span>` : ''}
    </div>
    <div class="upload-actions">
      <input id="custom-icon-upload" class="file-input" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" data-dialog-upload="iconUrl" data-upload-kind="icon" data-custom-icon>
      <button class="button button-quiet button-small" type="button" data-file-target="custom-icon-upload">Enviar ícone personalizado</button>
    </div>
    <div class="upload-progress" hidden><span></span></div>
    <p class="form-message form-message-error" role="alert" hidden></p>
  </div>`;
}

function projectForm(item) {
  return `<div class="editor-grid">
    ${inputField({ name: 'name', label: 'Nome do projeto', value: item.name, required: true, maxlength: 100 })}
    ${inputField({ name: 'repositoryUrl', label: 'URL do repositório', value: item.repositoryUrl, type: 'url', placeholder: 'https://github.com/usuario/projeto' })}
    ${inputField({ name: 'homepageUrl', label: 'URL do projeto publicado', value: item.homepageUrl || '', type: 'url', placeholder: 'https://meu-projeto.vercel.app', span: 'field-span-2' })}
    ${textareaField({ name: 'summary', label: 'Resumo do card', value: item.summary, required: true, span: 'field-span-2', rows: 3, maxlength: 320 })}
    ${textareaField({ name: 'description', label: 'Descrição completa', value: item.description, required: true, span: 'field-span-2', rows: 6, maxlength: 1800 })}
    ${textareaField({ name: 'technologies', label: 'Tecnologias', value: Array.isArray(item.technologies) ? item.technologies.join(', ') : '', help: 'Separe por vírgula ou por linha.', span: 'field-span-2', rows: 2 })}
    ${dialogMediaField({ name: 'coverUrl', label: 'Capa do projeto', value: item.coverUrl, kind: 'project-cover', help: 'GIFs animados são aceitos.' })}
    <input type="hidden" name="coverPublicId" value="${escapeAttribute(item.coverPublicId || '')}">
    ${checkboxField({ name: 'visible', label: 'Exibir no portfólio', checked: item.visible !== false, span: 'field-span-2' })}
  </div>`;
}

function experienceForm(item) {
  return `<div class="editor-grid">
    ${inputField({ name: 'title', label: 'Título', value: item.title, required: true, maxlength: 140 })}
    ${inputField({ name: 'institution', label: 'Instituição ou empresa', value: item.institution, required: true, maxlength: 140 })}
    ${inputField({ name: 'period', label: 'Data exibida na timeline', value: item.period, required: true, placeholder: '2024–25', maxlength: 30 })}
    <div class="field"><label>Período detalhado</label><div class="editor-grid">
      <input name="startDate" type="text" value="${escapeAttribute(item.startDate || '')}" placeholder="Início: 2024-01" aria-label="Data inicial">
      <input name="endDate" type="text" value="${escapeAttribute(item.endDate || '')}" placeholder="Fim ou Atual" aria-label="Data final">
    </div><small>Use AAAA ou AAAA-MM. O rótulo acima controla o círculo da timeline.</small></div>
    ${textareaField({ name: 'description', label: 'Descrição', value: item.description, required: true, span: 'field-span-2', rows: 5, maxlength: 1000 })}
    ${checkboxField({ name: 'visible', label: 'Exibir no portfólio', checked: item.visible !== false, span: 'field-span-2' })}
  </div>`;
}

function folderForm(item) {
  return `<div class="editor-grid">
    ${inputField({ name: 'name', label: 'Nome da pasta', value: item.name, required: true, maxlength: 80, span: 'field-span-2' })}
    ${entityColorField('color', 'Cor principal', item.color || '#d991ba')}
    ${entityColorField('colorDeep', 'Cor profunda', item.colorDeep || '#8f5578')}
    ${checkboxField({ name: 'openByDefault', label: 'Abrir por padrão', checked: item.openByDefault !== false })}
    ${checkboxField({ name: 'visible', label: 'Exibir no portfólio', checked: item.visible !== false })}
  </div>`;
}

function skillForm(item) {
  const folders = sorted(state.portfolio.folders).map(folder => ({ value: folder.id, label: folder.name }));
  return `<div class="editor-grid">
    ${inputField({ name: 'name', label: 'Nome da habilidade', value: item.name, required: true, maxlength: 90 })}
    ${selectField({ name: 'folderId', label: 'Pasta', value: item.folderId, options: folders, required: true })}
    ${inputField({ name: 'title', label: 'Título completo no modal', value: item.title || item.name, required: true, maxlength: 180, span: 'field-span-2' })}
    ${inputField({ name: 'badge', label: 'Selo curto', value: item.badge, placeholder: 'em aprendizado', maxlength: 40 })}
    ${inputField({ name: 'status', label: 'Status no modal', value: item.status, placeholder: 'Tecnologia em prática', maxlength: 90 })}
    ${textareaField({ name: 'description', label: 'Descrição', value: item.description, required: true, span: 'field-span-2', rows: 4, maxlength: 900 })}
    ${textareaField({ name: 'details', label: 'Pontos de destaque', value: Array.isArray(item.details) ? item.details.join('\n') : '', help: 'Use uma linha para cada item.', span: 'field-span-2', rows: 5 })}
    ${iconPicker(item.iconId, item.iconUrl)}
    ${checkboxField({ name: 'visible', label: 'Exibir no portfólio', checked: item.visible !== false, span: 'field-span-2' })}
  </div>`;
}

function contactForm(item) {
  return `<div class="editor-grid">
    ${inputField({ name: 'label', label: 'Nome do contato', value: item.label, required: true, maxlength: 70 })}
    ${selectField({ name: 'type', label: 'Tipo de link', value: item.type || 'external', options: [{ value: 'external', label: 'Site externo' }, { value: 'email', label: 'E-mail' }, { value: 'phone', label: 'Telefone' }, { value: 'anchor', label: 'Área desta página' }] })}
    ${inputField({ name: 'url', label: 'URL ou destino', value: item.url, required: true, placeholder: 'https://…, email@exemplo.com, +55… ou #contato', help: 'E-mails e telefones podem ser informados com ou sem mailto: e tel:.', span: 'field-span-2' })}
    ${inputField({ name: 'ariaLabel', label: 'Descrição para leitores de tela', value: item.ariaLabel, required: true, maxlength: 120 })}
    ${inputField({ name: 'title', label: 'Texto ao passar o mouse', value: item.title, maxlength: 90 })}
    ${iconPicker(item.iconId, item.iconUrl || '', { contactsOnly: true })}
    ${checkboxField({ name: 'visible', label: 'Exibir no portfólio', checked: item.visible !== false, span: 'field-span-2' })}
  </div>`;
}

function openEntityEditor(type, id = null, preset = {}) {
  const collectionKey = COLLECTION_FOR_TYPE[type];
  if (!collectionKey) return;
  const existing = id ? state.portfolio[collectionKey].find(item => item.id === id) : null;
  const item = existing ? deepClone(existing) : blankEntity(type, preset);
  state.editing = { type, id: item.id, isNew: !existing, originalFolderId: item.folderId || null };

  const labels = {
    project: ['Projeto', existing ? 'Editar projeto' : 'Adicionar projeto'],
    experience: ['Experiência', existing ? 'Editar experiência' : 'Adicionar experiência'],
    folder: ['Pasta', existing ? 'Editar pasta' : 'Criar pasta'],
    skill: ['Habilidade', existing ? 'Editar habilidade' : 'Adicionar habilidade'],
    contact: ['Contato', existing ? 'Editar contato' : 'Adicionar contato']
  };
  const formRenderers = { project: projectForm, experience: experienceForm, folder: folderForm, skill: skillForm, contact: contactForm };
  elements.entityKicker.textContent = labels[type][0];
  elements.entityTitle.textContent = labels[type][1];
  elements.entitySubmit.textContent = existing ? 'Aplicar alterações' : `Adicionar ${TYPE_LABEL[type]}`;
  elements.entityFields.innerHTML = formRenderers[type](item);
  elements.entityDialog.showModal();
  document.body.classList.add('is-dialog-open');
  window.setTimeout(() => $('input:not([type="hidden"]), textarea, select', elements.entityFields)?.focus(), 30);
}

function formBoolean(formData, name) {
  return formData.has(name);
}

function lines(value) {
  return String(value || '').split(/\n|,/).map(item => item.trim()).filter(Boolean);
}

function normalizeContactTarget(type, value) {
  const target = String(value || '').trim();
  if (!target) return { value: '', error: 'Informe o destino deste contato.' };

  if (type === 'email') {
    const normalized = /^mailto:/i.test(target) ? target : `mailto:${target}`;
    const address = normalized.slice(normalized.indexOf(':') + 1).split('?')[0];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
      ? { value: normalized, error: '' }
      : { value: target, error: 'Informe um e-mail válido.' };
  }

  if (type === 'phone') {
    const rawPhone = target.replace(/^tel:/i, '').trim();
    if (!/^\+?[\d().\s-]{5,}$/.test(rawPhone)) {
      return { value: target, error: 'Informe um telefone válido, incluindo o DDD.' };
    }
    return { value: `tel:${rawPhone.replace(/\s+/g, '')}`, error: '' };
  }

  if (type === 'anchor') {
    return /^#[A-Za-z][\w:.-]*$/.test(target)
      ? { value: target, error: '' }
      : { value: target, error: 'Use uma âncora como #contact-form.' };
  }

  if (/^\/(?!\/)/.test(target)) return { value: target, error: '' };
  try {
    const parsed = new URL(target);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return { value: parsed.href, error: '' };
  } catch {
    // A mensagem específica abaixo orienta a correção.
  }
  return { value: target, error: 'Use uma URL completa iniciada por https://.' };
}

function entityFromForm(type, current, formData) {
  if (type === 'project') return {
    ...current,
    name: String(formData.get('name') || '').trim(),
    summary: String(formData.get('summary') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    technologies: lines(formData.get('technologies')),
    coverUrl: String(formData.get('coverUrl') || '').trim(),
    repositoryUrl: String(formData.get('repositoryUrl') || '').trim(),
    homepageUrl: String(formData.get('homepageUrl') || '').trim(),
    coverPublicId: String(formData.get('coverPublicId') || '').trim(),
    visible: formBoolean(formData, 'visible'),
    source: current.source || 'manual'
  };
  if (type === 'experience') return {
    ...current,
    title: String(formData.get('title') || '').trim(),
    institution: String(formData.get('institution') || '').trim(),
    period: String(formData.get('period') || '').trim(),
    startDate: String(formData.get('startDate') || '').trim(),
    endDate: String(formData.get('endDate') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    visible: formBoolean(formData, 'visible')
  };
  if (type === 'folder') return {
    ...current,
    name: String(formData.get('name') || '').trim(),
    color: String(formData.get('color') || '#d991ba').trim(),
    colorDeep: String(formData.get('colorDeep') || '#8f5578').trim(),
    openByDefault: formBoolean(formData, 'openByDefault'),
    visible: formBoolean(formData, 'visible')
  };
  if (type === 'skill') return {
    ...current,
    name: String(formData.get('name') || '').trim(),
    title: String(formData.get('title') || formData.get('name') || '').trim(),
    folderId: String(formData.get('folderId') || '').trim(),
    badge: String(formData.get('badge') || '').trim(),
    status: String(formData.get('status') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    details: lines(String(formData.get('details') || '').replaceAll(',', '\n')),
    iconId: String(formData.get('iconId') || 'code'),
    iconUrl: String(formData.get('iconUrl') || '').trim(),
    visible: formBoolean(formData, 'visible')
  };
  return {
    ...current,
    label: String(formData.get('label') || '').trim(),
    type: String(formData.get('type') || 'external'),
    url: String(formData.get('url') || '').trim(),
    ariaLabel: String(formData.get('ariaLabel') || '').trim(),
    title: String(formData.get('title') || '').trim(),
    iconId: String(formData.get('iconId') || 'mail'),
    iconUrl: String(formData.get('iconUrl') || '').trim(),
    visible: formBoolean(formData, 'visible')
  };
}

function commitEntityForm(event) {
  event.preventDefault();
  if (!state.editing || !elements.entityForm.reportValidity()) return;
  const { type, id, isNew, originalFolderId } = state.editing;
  const collectionKey = COLLECTION_FOR_TYPE[type];
  const collection = state.portfolio[collectionKey];
  const current = isNew ? blankEntity(type, { id }) : deepClone(collection.find(item => item.id === id));
  if (!current) return;
  const formData = new FormData(elements.entityForm);
  if (type === 'contact') {
    const targetField = $('[name="url"]', elements.entityForm);
    const normalizedTarget = normalizeContactTarget(String(formData.get('type') || 'external'), formData.get('url'));
    targetField?.setCustomValidity(normalizedTarget.error);
    if (normalizedTarget.error) {
      targetField?.reportValidity();
      targetField?.focus();
      return;
    }
    formData.set('url', normalizedTarget.value);
  }
  const value = entityFromForm(type, current, formData);

  if (type === 'skill' && !isNew && originalFolderId !== value.folderId) {
    value.order = nextOrder(collection, item => item.id !== id && item.folderId === value.folderId);
  }

  if (type === 'project' && value.source !== 'github' && !value.coverUrl) {
    const field = $('[data-dialog-media-field="coverUrl"]', elements.entityForm);
    const message = $('.form-message', field);
    if (message) {
      message.textContent = 'Envie uma capa para o projeto antes de continuar.';
      message.hidden = false;
    }
    $('[data-file-target="dialog-upload-coverUrl"]', field)?.focus();
    return;
  }

  if (isNew) collection.push(value);
  else {
    const index = collection.findIndex(item => item.id === id);
    collection[index] = value;
  }

  if (type === 'skill') {
    normalizeOrder(collection, item => item.folderId === originalFolderId);
    normalizeOrder(collection, item => item.folderId === value.folderId);
  } else {
    normalizeOrder(collection);
  }
  closeDialog(elements.entityDialog);
  state.editing = null;
  markDirty(`${TYPE_LABEL[type]} ${isNew ? 'adicionado' : 'atualizado'}.`);
  render();
  toast(`${TYPE_LABEL[type][0].toUpperCase()}${TYPE_LABEL[type].slice(1)} ${isNew ? 'adicionado' : 'atualizado'}.`, 'success');
}

function clearGitHubCandidate({ keepRepository = true } = {}) {
  state.githubCandidate = null;
  if (!keepRepository) elements.githubForm.reset();
  elements.githubPreview.hidden = true;
  elements.githubPreview.replaceChildren();
  elements.githubDescriptionField.hidden = true;
  elements.githubDescription.value = '';
  elements.githubError.hidden = true;
  elements.githubSubmit.textContent = 'Buscar repositório';
}

function openGitHubImporter() {
  state.githubController?.abort();
  state.githubController = null;
  clearGitHubCandidate({ keepRepository: false });
  elements.githubRepository.disabled = false;
  elements.githubForm.removeAttribute('aria-busy');
  elements.githubSubmit.disabled = false;
  elements.githubDialog.showModal();
  document.body.classList.add('is-dialog-open');
  window.setTimeout(() => elements.githubRepository.focus(), 30);
}

function normalizeGitHubResult(result, input) {
  const github = result?.github || result?.repository || {};
  const owner = result?.owner || github.owner || result?.user || '';
  const repo = result?.repo || github.repo || github.name || result?.name || '';
  const repositoryUrl = result?.repositoryUrl || result?.htmlUrl || result?.html_url || github.htmlUrl || github.html_url || (/^https?:\/\//i.test(input) ? input : `https://github.com/${input.replace(/^\/+|\/+$/g, '')}`);
  const technologies = result?.technologies || result?.topics || github.topics || [];
  const language = result?.language || github.language;
  const mergedTechnologies = [...new Set([language, ...(Array.isArray(technologies) ? technologies : [])].filter(Boolean))];
  const fallbackCover = owner && repo ? `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` : '';
  return {
    name: result?.name || repo || 'Projeto do GitHub',
    summary: result?.summary || result?.description || '',
    description: result?.description || result?.summary || '',
    technologies: mergedTechnologies,
    coverUrl: result?.coverUrl || result?.socialPreviewUrl || fallbackCover,
    repositoryUrl,
    homepageUrl: result?.homepageUrl || result?.homepage || '',
    github: {
      owner,
      repo,
      defaultBranch: result?.defaultBranch || github.defaultBranch || github.default_branch || '',
      language: language || '',
      topics: Array.isArray(result?.topics || github.topics) ? (result?.topics || github.topics) : []
    }
  };
}

const ASSISTANT_FIELDS = Object.freeze({
  project: ['name', 'summary', 'description', 'technologies', 'coverUrl', 'coverPublicId', 'repositoryUrl', 'homepageUrl', 'visible'],
  experience: ['period', 'startDate', 'endDate', 'title', 'institution', 'description', 'visible'],
  folder: ['name', 'color', 'colorDeep', 'openByDefault', 'visible'],
  skill: ['folderId', 'name', 'title', 'badge', 'status', 'iconId', 'iconUrl', 'certificateUrl', 'description', 'details', 'visible'],
  contact: ['type', 'label', 'url', 'iconId', 'iconUrl', 'ariaLabel', 'title', 'visible']
});

function assistantPayload(operation) {
  try {
    const value = JSON.parse(String(operation?.payloadJson || '{}'));
    if (!isPlainObject(value)) throw new Error();
    return value;
  } catch {
    throw new Error('A Nyan retornou uma proposta inválida. Tente reformular o pedido.');
  }
}

function safeAssistantValue(value, currentValue) {
  if (typeof currentValue === 'boolean') return typeof value === 'boolean' ? value : currentValue;
  if (typeof currentValue === 'number') return Number.isFinite(Number(value)) ? Number(value) : currentValue;
  if (Array.isArray(currentValue)) {
    return Array.isArray(value)
      ? value.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 500)).filter(Boolean).slice(0, 50)
      : currentValue;
  }
  if (typeof currentValue === 'string') return typeof value === 'string' ? value.trim().slice(0, 10000) : currentValue;
  return currentValue;
}

function safeAssistantUrl(value, { allowLocal = true, allowContact = false } = {}) {
  const text = typeof value === 'string' ? value.trim().slice(0, 2048) : '';
  if (!text) return '';
  if (allowLocal && /^\/(?!\/)/.test(text)) return text;
  if (allowContact) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
    if (/^#[A-Za-z][\w:.-]*$/.test(text) || /^(?:mailto|tel):[^\s]+$/i.test(text)) return text;
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch {
    // A URL inválida será recusada abaixo.
  }
  throw new Error('A proposta contém um link inválido ou inseguro.');
}

function assistantEntityChanges(type, changes, current) {
  if (!ASSISTANT_FIELDS[type] || !isPlainObject(changes)) throw new Error('A proposta contém um tipo de item inválido.');
  const result = {};
  ASSISTANT_FIELDS[type].forEach(field => {
    if (!(field in changes) || !(field in current)) return;
    if (['coverUrl', 'repositoryUrl', 'homepageUrl', 'iconUrl', 'certificateUrl'].includes(field)) {
      result[field] = safeAssistantUrl(changes[field]);
    } else if (type === 'contact' && field === 'url') {
      result[field] = safeAssistantUrl(changes[field], { allowContact: true });
    } else if (['color', 'colorDeep'].includes(field)) {
      const color = String(changes[field] || '').trim();
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('A proposta contém uma cor inválida.');
      result[field] = color.toLowerCase();
    } else if (type === 'contact' && field === 'type') {
      result[field] = ['external', 'anchor', 'email', 'phone'].includes(changes[field]) ? changes[field] : current[field];
    } else {
      result[field] = safeAssistantValue(changes[field], current[field]);
    }
  });
  return result;
}

function requireAssistantText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`A proposta ainda precisa informar ${label}.`);
  return text;
}

function normalizeAssistantRepository(message) {
  const url = String(message || '').match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z\d-]+\/[A-Za-z\d_.-]+/i)?.[0];
  const short = String(message || '').match(/(?:^|\s)([A-Za-z\d-]+\/[A-Za-z\d_.-]+)(?=$|[\s,.;])/i)?.[1];
  const candidate = url || short;
  if (!candidate) return '';
  try {
    const parsed = parseGitHubRepository(candidate);
    return `${parsed.owner}/${parsed.repository}`;
  } catch {
    return '';
  }
}

async function prepareAssistantGitHubCandidate(message) {
  const repository = normalizeAssistantRepository(message);
  if (!repository) return null;
  const result = await importGitHubRepository(repository, { includeImages: true });
  return { ...normalizeGitHubResult(result, repository), repositoryImages: result.repositoryImages || [] };
}

async function applyAssistantProposal(operations) {
  if (!state.user || !state.portfolio) throw new Error('Sua sessão administrativa não está disponível.');
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 12) {
    throw new Error('A proposta da Nyan está vazia ou é grande demais.');
  }

  const backup = deepClone(state.portfolio);
  let requestedSection = '';
  let shouldSave = false;
  let changed = false;

  try {
    for (const operation of operations) {
      const payload = assistantPayload(operation);
      if (operation.type === 'add_experience') {
        const base = blankEntity('experience');
        const value = { ...base, ...assistantEntityChanges('experience', payload, base) };
        requireAssistantText(value.title, 'o cargo ou título da experiência');
        requireAssistantText(value.institution, 'a instituição da experiência');
        requireAssistantText(value.period, 'o período da experiência');
        requireAssistantText(value.description, 'a descrição da experiência');
        state.portfolio.experiences.push(value);
        requestedSection = requestedSection || 'experiences';
        changed = true;
      } else if (operation.type === 'add_project') {
        const base = blankEntity('project');
        const value = { ...base, ...assistantEntityChanges('project', payload, base), source: 'manual' };
        requireAssistantText(value.name, 'o nome do projeto');
        requireAssistantText(value.description || value.summary, 'a descrição do projeto');
        requireAssistantText(value.coverUrl, 'a imagem de capa do projeto');
        state.portfolio.projects.push(value);
        requestedSection = requestedSection || 'projects';
        changed = true;
      } else if (operation.type === 'import_github_project') {
        const repository = requireAssistantText(payload.repository, 'o repositório do GitHub');
        const result = await importGitHubRepository(repository, { includeImages: true });
        const candidate = normalizeGitHubResult(result, repository);
        const duplicate = state.portfolio.projects.some(project => project.repositoryUrl?.replace(/\/$/, '').toLowerCase() === candidate.repositoryUrl.replace(/\/$/, '').toLowerCase());
        if (duplicate) throw new Error('Esse repositório já está cadastrado no portfólio.');
        const description = typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim()
          : (candidate.description || candidate.summary);
        requireAssistantText(description, 'a descrição do projeto importado');
        state.portfolio.projects.push(blankEntity('project', {
          ...candidate,
          id: createId('project'),
          description,
          summary: candidate.summary || description.slice(0, 260),
          source: 'github',
          visible: true
        }));
        requestedSection = requestedSection || 'projects';
        changed = true;
      } else if (operation.type === 'add_folder') {
        const base = blankEntity('folder');
        const value = { ...base, ...assistantEntityChanges('folder', payload, base) };
        requireAssistantText(value.name, 'o nome da pasta');
        state.portfolio.folders.push(value);
        requestedSection = requestedSection || 'folders';
        changed = true;
      } else if (operation.type === 'add_skill') {
        const requestedFolderName = String(payload.folderName || '').trim().toLowerCase();
        const resolvedFolderId = state.portfolio.folders.some(folder => folder.id === payload.folderId)
          ? payload.folderId
          : state.portfolio.folders.find(folder => folder.name.toLowerCase() === requestedFolderName)?.id;
        const base = blankEntity('skill', resolvedFolderId ? { folderId: resolvedFolderId } : {});
        const value = { ...base, ...assistantEntityChanges('skill', payload, base) };
        requireAssistantText(value.name, 'o nome da habilidade');
        if (!value.folderId) throw new Error('Crie ou informe uma pasta para a nova habilidade.');
        state.portfolio.skills.push(value);
        requestedSection = requestedSection || 'folders';
        changed = true;
      } else if (operation.type === 'add_contact') {
        const base = blankEntity('contact');
        const value = { ...base, ...assistantEntityChanges('contact', payload, base) };
        requireAssistantText(value.label, 'o nome do contato');
        requireAssistantText(value.url, 'o link do contato');
        state.portfolio.contacts.push(value);
        requestedSection = requestedSection || 'contact';
        changed = true;
      } else if (operation.type === 'update_entity') {
        const type = String(payload.entityType || '');
        const id = String(payload.id || '');
        const current = findEntity(type, id);
        if (!current) throw new Error('Não encontrei o item que a Nyan tentou atualizar.');
        Object.assign(current, assistantEntityChanges(type, payload.changes, current));
        if (type === 'project') requireAssistantText(current.name, 'o nome do projeto');
        if (type === 'experience') requireAssistantText(current.title, 'o título da experiência');
        if (type === 'folder') requireAssistantText(current.name, 'o nome da pasta');
        if (type === 'skill') {
          requireAssistantText(current.name, 'o nome da habilidade');
          if (!state.portfolio.folders.some(folder => folder.id === current.folderId)) throw new Error('A pasta escolhida para a habilidade não existe.');
        }
        if (type === 'contact') {
          requireAssistantText(current.label, 'o nome do contato');
          requireAssistantText(current.url, 'o link do contato');
        }
        requestedSection = requestedSection || ({ project: 'projects', experience: 'experiences', folder: 'folders', skill: 'folders', contact: 'contact' }[type] || 'overview');
        changed = true;
      } else if (operation.type === 'remove_entity') {
        const type = String(payload.entityType || '');
        const id = String(payload.id || '');
        const key = COLLECTION_FOR_TYPE[type];
        if (!key || !state.portfolio[key].some(item => item.id === id)) throw new Error('Não encontrei o item que a Nyan tentou remover.');
        state.portfolio[key] = state.portfolio[key].filter(item => item.id !== id);
        if (type === 'folder') state.portfolio.skills = state.portfolio.skills.filter(item => item.folderId !== id);
        requestedSection = requestedSection || ({ project: 'projects', experience: 'experiences', folder: 'folders', skill: 'folders', contact: 'contact' }[type] || 'overview');
        changed = true;
      } else if (operation.type === 'set_setting') {
        const path = String(payload.path || '');
        if (!/^settings(?:\.[A-Za-z][A-Za-z0-9_]*){2,4}$/.test(path) || /(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/.test(path)) {
          throw new Error('A proposta tentou alterar uma configuração não permitida.');
        }
        const missing = Symbol('missing-setting');
        const currentValue = getPath(state.portfolio, path, missing);
        if (currentValue === missing || (isPlainObject(currentValue) && !Array.isArray(currentValue))) {
          throw new Error('A configuração solicitada não existe no painel.');
        }
        let nextValue = safeAssistantValue(payload.value, currentValue);
        if (/(?:Url|URL)$/.test(path)) nextValue = safeAssistantUrl(payload.value);
        if (/settings\.theme\.(?:bg|panel|panelAlt|border|accent|accentLight|accentDeep|text|muted)$/.test(path)) {
          const color = String(payload.value || '').trim();
          if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('A proposta contém uma cor de tema inválida.');
          nextValue = color.toLowerCase();
        }
        if (path === 'settings.theme.radius' && !/^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(String(payload.value || '').trim())) {
          throw new Error('A proposta contém um raio de borda inválido.');
        }
        if (/Email$/.test(path) && nextValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValue)) {
          throw new Error('A proposta contém um e-mail inválido.');
        }
        setPath(state.portfolio, path, nextValue);
        requestedSection = requestedSection || (path.startsWith('settings.theme.') || path.startsWith('settings.meta.') || path.startsWith('settings.about.bunny') ? 'appearance' : 'page');
        changed = true;
      } else if (operation.type === 'navigate') {
        const section = String(payload.section || '');
        if (!SECTION_META[section]) throw new Error('A seção solicitada não existe no painel.');
        requestedSection = section;
      } else if (operation.type === 'save_portfolio') {
        shouldSave = true;
      } else {
        throw new Error('A proposta contém uma operação não permitida.');
      }
    }

    ['projects', 'experiences', 'folders', 'contacts'].forEach(key => normalizeOrder(state.portfolio[key]));
    state.portfolio.folders.forEach(folder => normalizeOrder(state.portfolio.skills, item => item.folderId === folder.id));
    if (changed) markDirty('Alterações propostas pela Nyan aplicadas.');
    if (requestedSection) navigateSection(requestedSection, { focusMain: false });
    else render();
    if (shouldSave && changed) await saveChanges();
    toast(shouldSave && changed ? 'Alterações aplicadas e publicadas.' : 'Alterações aplicadas. Revise e salve quando estiver tudo certo.', 'success', 5600);
    return { message: shouldSave && changed ? 'Pronto: apliquei e publiquei as alterações.' : 'Pronto: apliquei a proposta ao painel. Revise o resultado e clique em “Salvar alterações” quando estiver tudo certo.' };
  } catch (error) {
    state.portfolio = backup;
    render();
    throw error;
  }
}

async function initAdminAssistant() {
  if (state.assistantRenderer || !elements.assistantRoot || !state.user) return;
  const { renderAdminAssistant } = await import('./admin-assistant.jsx');
  if (!state.user || elements.app.hidden) return;
  state.assistantRenderer = renderAdminAssistant(elements.assistantRoot, {
    getPortfolioData: () => deepClone(state.portfolio),
    getSection: () => state.section,
    getIdToken: forceRefresh => state.user?.getIdToken(Boolean(forceRefresh)),
    prepareGitHubCandidate: prepareAssistantGitHubCandidate,
    applyProposal: applyAssistantProposal
  });
}

function destroyAdminAssistant() {
  state.assistantRenderer?.unmount?.();
  state.assistantRenderer = null;
  elements.assistantRoot?.replaceChildren();
}

async function handleGitHubSubmit(event) {
  event.preventDefault();
  elements.githubError.hidden = true;

  if (!state.githubCandidate) {
    if (!elements.githubRepository.reportValidity()) return;
    const input = elements.githubRepository.value.trim();
    state.githubController?.abort();
    const controller = new AbortController();
    state.githubController = controller;
    elements.githubRepository.disabled = true;
    elements.githubForm.setAttribute('aria-busy', 'true');
    elements.githubSubmit.disabled = true;
    elements.githubSubmit.textContent = 'Buscando…';
    try {
      const result = await importGitHubRepository(input, { signal: controller.signal });
      if (controller.signal.aborted || !elements.githubDialog.open) return;
      const candidate = normalizeGitHubResult(result, input);
      const duplicate = state.portfolio.projects.some(project => project.repositoryUrl && project.repositoryUrl.replace(/\/$/, '').toLowerCase() === candidate.repositoryUrl.replace(/\/$/, '').toLowerCase());
      if (duplicate) throw new Error('Este repositório já está cadastrado no portfólio.');
      state.githubCandidate = candidate;
      elements.githubPreview.innerHTML = `<h3>${escapeHTML(candidate.name)}</h3><p>${escapeHTML(candidate.repositoryUrl)}</p><div class="github-preview-tags">${candidate.technologies.map(item => `<span class="badge">${escapeHTML(item)}</span>`).join('') || '<span class="badge badge-muted">Sem tópicos informados</span>'}</div>`;
      elements.githubPreview.hidden = false;
      elements.githubDescriptionField.hidden = false;
      elements.githubDescription.value = candidate.description;
      elements.githubSubmit.textContent = 'Adicionar projeto';
      elements.githubDescription.focus();
    } catch (error) {
      if (controller.signal.aborted || error?.code === 'github/aborted') return;
      elements.githubError.textContent = friendlyError(error, 'Não foi possível importar este repositório.');
      elements.githubError.hidden = false;
      elements.githubSubmit.textContent = 'Buscar repositório';
    } finally {
      if (state.githubController === controller) {
        state.githubController = null;
        elements.githubRepository.disabled = false;
        elements.githubForm.removeAttribute('aria-busy');
        elements.githubSubmit.disabled = false;
      }
    }
    return;
  }

  if (!elements.githubDescription.reportValidity()) return;
  const candidate = state.githubCandidate;
  const project = blankEntity('project', {
    ...candidate,
    id: createId('project'),
    description: elements.githubDescription.value.trim(),
    summary: candidate.summary || elements.githubDescription.value.trim().slice(0, 260),
    source: 'github',
    visible: true
  });
  state.portfolio.projects.push(project);
  normalizeOrder(state.portfolio.projects);
  closeDialog(elements.githubDialog);
  state.githubCandidate = null;
  markDirty('Projeto importado do GitHub.');
  if (state.section !== 'projects') navigateSection('projects');
  else render();
  toast('Projeto importado. Revise os dados e salve as alterações.', 'success');
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.close();
  const anotherOpen = $$('dialog[open]').length > 0;
  document.body.classList.toggle('is-dialog-open', anotherOpen);
}

function requestConfirmation({ title = 'Confirmar ação', message, action = 'Confirmar', danger = true }) {
  if (state.confirmResolve) state.confirmResolve(false);
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = action;
  elements.confirmAccept.className = `button ${danger ? 'button-danger' : 'button-primary'}`;
  elements.confirmDialog.showModal();
  document.body.classList.add('is-dialog-open');
  elements.confirmCancel.focus();
  return new Promise(resolve => { state.confirmResolve = resolve; });
}

function resolveConfirmation(value) {
  const resolve = state.confirmResolve;
  state.confirmResolve = null;
  closeDialog(elements.confirmDialog);
  resolve?.(value);
}

function findEntity(type, id) {
  const key = COLLECTION_FOR_TYPE[type];
  return key ? state.portfolio[key].find(item => item.id === id) : null;
}

async function deleteEntity(type, id) {
  const key = COLLECTION_FOR_TYPE[type];
  const item = findEntity(type, id);
  if (!key || !item) return;
  const name = item.name || item.title || item.label || TYPE_LABEL[type];
  const childCount = type === 'folder' ? state.portfolio.skills.filter(skill => skill.folderId === id).length : 0;
  const extra = childCount ? ` As ${childCount} habilidade${childCount === 1 ? '' : 's'} dentro dela também serão excluídas.` : '';
  const confirmed = await requestConfirmation({
    title: `Excluir ${TYPE_LABEL[type]}?`,
    message: `“${name}” será removido quando você salvar.${extra}`,
    action: 'Excluir'
  });
  if (!confirmed) return;

  state.portfolio[key] = state.portfolio[key].filter(current => current.id !== id);
  if (type === 'folder') state.portfolio.skills = state.portfolio.skills.filter(skill => skill.folderId !== id);
  normalizeOrder(state.portfolio[key]);
  markDirty(`${TYPE_LABEL[type]} excluído.`);
  render();
  toast(`${TYPE_LABEL[type][0].toUpperCase()}${TYPE_LABEL[type].slice(1)} removido.`, 'success');
}

function toggleEntity(type, id) {
  const item = findEntity(type, id);
  if (!item) return;
  item.visible = item.visible === false;
  markDirty(`${item.visible ? 'Exibido' : 'Ocultado'} no portfólio.`);
  render();
}

function moveEntity(type, id, direction) {
  const key = COLLECTION_FOR_TYPE[type];
  const item = findEntity(type, id);
  if (!key || !item) return;
  const sameGroup = current => type !== 'skill' || current.folderId === item.folderId;
  const ordered = sorted(state.portfolio[key].filter(sameGroup));
  const from = ordered.findIndex(current => current.id === id);
  const to = from + Number(direction);
  if (from < 0 || to < 0 || to >= ordered.length) return;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  ordered.forEach((current, index) => { current.order = index; });
  markDirty(`${item.name || item.title || item.label || 'Item'} movido.`);
  render();
  const movedButton = $(`[data-action="move"][data-type="${CSS.escape(type)}"][data-id="${CSS.escape(id)}"][data-direction="${direction}"]`, elements.content);
  movedButton?.focus();
}

function navigateSection(section, { focusMain = true } = {}) {
  if (!SECTION_META[section]) return;
  abortUploadsWithin(elements.content);
  state.section = section;
  render();
  closeSidebar();
  if (focusMain) {
    elements.content.closest('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function updateThemePreview() {
  const preview = $('#theme-preview', elements.content);
  if (!preview) return;
  const theme = state.portfolio.settings.theme;
  preview.style.setProperty('--preview-bg', theme.bg);
  preview.style.setProperty('--preview-panel', theme.panel);
  preview.style.setProperty('--preview-border', theme.border);
  preview.style.setProperty('--preview-accent', theme.accent);
  preview.style.setProperty('--preview-text', theme.text);
  preview.style.setProperty('--preview-muted', theme.muted);
  preview.style.setProperty('--preview-radius', theme.radius);
}

async function resetTheme() {
  const confirmed = await requestConfirmation({
    title: 'Restaurar o tema original?',
    message: 'Todas as cores e o raio dos cantos voltarão ao tema rosa padrão. Os demais conteúdos não serão alterados.',
    action: 'Restaurar',
    danger: false
  });
  if (!confirmed) return;
  state.portfolio.settings.theme = deepClone(DEFAULT_PORTFOLIO.settings.theme);
  state.portfolio.settings.meta.themeColor = DEFAULT_PORTFOLIO.settings.meta.themeColor;
  markDirty('Tema original restaurado.');
  render();
  toast('Tema rosa original restaurado.', 'success');
}

async function resetMedia(path) {
  const defaultValue = getPath(DEFAULT_PORTFOLIO, path, '');
  const confirmed = await requestConfirmation({
    title: 'Restaurar imagem padrão?',
    message: 'O site voltará a usar o arquivo original incluído no projeto.',
    action: 'Restaurar',
    danger: false
  });
  if (!confirmed) return;
  setPath(state.portfolio, path, defaultValue);
  markDirty('Imagem padrão restaurada.');
  render();
}

function uploadProgressValue(value) {
  if (typeof value === 'number') return value <= 1 ? value * 100 : value;
  const numeric = value?.percent ?? value?.progress ?? (value?.loaded && value?.total ? value.loaded / value.total * 100 : 0);
  return numeric <= 1 ? numeric * 100 : numeric;
}

function mediaUrl(result) {
  return result?.secureUrl || result?.secure_url || result?.url || result?.src || '';
}

function abortUploadsWithin(root = document) {
  state.uploadControllers.forEach((controller, input) => {
    if (root === document || root?.contains(input)) controller.abort();
  });
}

async function handleUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const container = input.closest('.media-card, .icon-picker');
  if (!container) return;
  const message = $('.form-message', container);
  const progress = $('.upload-progress', container);
  const progressBar = $('.upload-progress > span', container);
  if (message) message.hidden = true;

  const validation = await validateMediaFile(file);
  if (validation === false || validation?.valid === false) {
    if (message) {
      message.textContent = validation?.error || `Escolha uma imagem com até ${formatBytes(validation?.maxBytes || MAX_UPLOAD_BYTES)}.`;
      message.hidden = false;
    }
    input.value = '';
    return;
  }

  const previous = state.uploadControllers.get(input);
  previous?.abort();
  const controller = new AbortController();
  state.uploadControllers.set(input, controller);
  input.disabled = true;
  container.setAttribute('aria-busy', 'true');
  if (progress) progress.hidden = false;
  if (progressBar) progressBar.style.setProperty('--upload-progress', '4%');

  try {
    const kind = input.dataset.uploadKind || 'portfolio';
    const result = await uploadMedia(file, {
      folder: `portfolio-jessica/${kind}`,
      signal: controller.signal,
      onProgress(value) {
        const percent = Math.max(4, Math.min(100, uploadProgressValue(value)));
        progressBar?.style.setProperty('--upload-progress', `${percent}%`);
      }
    });
    if (controller.signal.aborted || !input.isConnected) return;
    const url = mediaUrl(result);
    if (!url) throw new Error('O serviço de mídia não retornou a URL do arquivo.');

    if (input.dataset.mediaUpload) {
      setPath(state.portfolio, input.dataset.mediaUpload, url);
      markDirty('Imagem atualizada.');
      render();
    } else if (input.dataset.dialogUpload) {
      const fieldName = input.dataset.dialogUpload;
      const hidden = $(`[name="${CSS.escape(fieldName)}"]`, elements.entityForm);
      if (hidden) hidden.value = url;
      if (fieldName === 'coverUrl') {
        const publicId = $('[name="coverPublicId"]', elements.entityForm);
        if (publicId) publicId.value = result?.publicId || result?.public_id || '';
      }
      if (input.hasAttribute('data-custom-icon')) {
        const iconId = $('[name="iconId"]', elements.entityForm);
        if (iconId) iconId.value = 'custom';
        $$('.icon-option', elements.entityForm).forEach(option => {
          option.classList.remove('is-selected');
          option.setAttribute('aria-selected', 'false');
        });
        const customPreview = $('[data-custom-icon-preview]', container);
        if (customPreview) {
          customPreview.innerHTML = `<img src="${escapeAttribute(url)}" alt=""><span>Ícone personalizado selecionado</span>`;
          customPreview.hidden = false;
        }
      }
      const preview = $('.media-preview', container);
      if (preview) preview.innerHTML = `<img src="${escapeAttribute(url)}" alt="Prévia do arquivo enviado">`;
      toast('Upload concluído.', 'success');
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && message) {
      message.textContent = friendlyError(error, 'Não foi possível enviar a imagem.');
      message.hidden = false;
    }
  } finally {
    state.uploadControllers.delete(input);
    input.disabled = false;
    container.removeAttribute('aria-busy');
    if (progressBar) progressBar.style.setProperty('--upload-progress', '100%');
    window.setTimeout(() => { if (progress) progress.hidden = true; }, 500);
    input.value = '';
  }
}

function handleContentAction(button) {
  const action = button.dataset.action;
  if (!action) return;
  if (action === 'new-project') return openEntityEditor('project');
  if (action === 'github-import') return openGitHubImporter();
  if (action === 'new-experience') return openEntityEditor('experience');
  if (action === 'new-folder') return openEntityEditor('folder');
  if (action === 'new-skill') {
    if (!state.portfolio.folders.length) {
      toast('Crie uma pasta antes de adicionar uma habilidade.', 'error');
      return;
    }
    return openEntityEditor('skill', null, { folderId: button.dataset.folderId || sorted(state.portfolio.folders)[0].id });
  }
  if (action === 'new-contact') return openEntityEditor('contact');
  if (action === 'edit') return openEntityEditor(button.dataset.type, button.dataset.id);
  if (action === 'delete') return deleteEntity(button.dataset.type, button.dataset.id);
  if (action === 'toggle-visible') return toggleEntity(button.dataset.type, button.dataset.id);
  if (action === 'move') return moveEntity(button.dataset.type, button.dataset.id, Number(button.dataset.direction));
  if (action === 'reset-theme') return resetTheme();
  if (action === 'reset-media') return resetMedia(button.dataset.path);
  if (action === 'navigate') return navigateSection(button.dataset.section);
}

function handleSettingInput(input) {
  const path = input.dataset.settingPath;
  if (!path || !state.portfolio) return;
  const valid = input.checkValidity();
  input.setAttribute('aria-invalid', String(!valid));
  if (!valid) return;
  let value;
  if (input.type === 'checkbox') value = input.checked;
  else if (input.dataset.arrayLines === 'true') value = String(input.value).split('\n').map(item => item.trim()).filter(Boolean);
  else if (input.type === 'number') value = Number(input.value);
  else value = input.value;

  if (input.dataset.colorText) {
    const valid = /^#[0-9a-f]{6}$/i.test(String(value));
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) return;
    const color = $(`[data-color-for="${CSS.escape(input.dataset.colorText)}"]`, elements.content);
    if (color) color.value = value;
  }

  setPath(state.portfolio, path, value);
  markDirty();
  if (path.startsWith('settings.theme.')) updateThemePreview();
}

function filterRows(input) {
  const term = input.value.trim().toLocaleLowerCase('pt-BR');
  const type = input.dataset.filterRows;
  $$(`.entity-row[data-type="${CSS.escape(type)}"]`, elements.content).forEach(row => {
    row.hidden = Boolean(term) && !row.textContent.toLocaleLowerCase('pt-BR').includes(term);
  });
}

function handleIconChoice(button) {
  const form = button.closest('form');
  const idInput = $('[name="iconId"]', form);
  const urlInput = $('[name="iconUrl"]', form);
  if (idInput) idInput.value = button.dataset.iconId;
  if (urlInput) urlInput.value = button.dataset.iconUrl;
  $$('.icon-option', form).forEach(option => {
    const selected = option === button;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-selected', String(selected));
  });
  const customPreview = $('[data-custom-icon-preview]', form);
  if (customPreview) {
    customPreview.hidden = true;
    customPreview.replaceChildren();
  }
}

function filterIcons(input) {
  const term = input.value.trim().toLocaleLowerCase('pt-BR');
  $$('.icon-option', input.closest('.icon-picker')).forEach(option => {
    option.hidden = Boolean(term) && !option.dataset.iconSearchValue.includes(term);
  });
}

function syncEntityColor(input) {
  const name = input.dataset.entityColorFor;
  const textInput = $(`[name="${CSS.escape(name)}"]`, elements.entityForm);
  if (textInput) textInput.value = input.value;
}

function startDrag(event) {
  const row = event.target.closest('[draggable="true"][data-type][data-id]');
  if (!row || event.target.closest('button:not(.drag-handle), input, textarea, select, a')) {
    event.preventDefault();
    return;
  }
  state.drag = { type: row.dataset.type, id: row.dataset.id, parent: row.dataset.parent || '' };
  row.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', row.dataset.id);
}

function dragOver(event) {
  if (!state.drag) return;
  const target = event.target.closest('[draggable="true"][data-type][data-id]');
  if (!target || target.dataset.type !== state.drag.type || (target.dataset.parent || '') !== state.drag.parent) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  $$('[draggable="true"].is-drop-target', elements.content).forEach(item => item.classList.remove('is-drop-target'));
  if (target.dataset.id !== state.drag.id) target.classList.add('is-drop-target');
}

function dropEntity(event) {
  if (!state.drag) return;
  const target = event.target.closest('[draggable="true"][data-type][data-id]');
  if (!target || target.dataset.type !== state.drag.type || (target.dataset.parent || '') !== state.drag.parent) return;
  event.preventDefault();
  const type = state.drag.type;
  const key = COLLECTION_FOR_TYPE[type];
  const filter = item => type !== 'skill' || item.folderId === state.drag.parent;
  const ordered = sorted(state.portfolio[key].filter(filter));
  const from = ordered.findIndex(item => item.id === state.drag.id);
  const to = ordered.findIndex(item => item.id === target.dataset.id);
  if (from >= 0 && to >= 0 && from !== to) {
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    ordered.forEach((item, index) => { item.order = index; });
    markDirty(`${moved.name || moved.title || moved.label || 'Item'} reordenado.`);
    render();
  }
  clearDragState();
}

function clearDragState() {
  state.drag = null;
  $$('.is-dragging, .is-drop-target', elements.content).forEach(item => item.classList.remove('is-dragging', 'is-drop-target'));
}

async function saveChanges() {
  if (!isDirty() || state.saving) return;
  const invalidSetting = $('[data-setting-path]:invalid', elements.content);
  if (invalidSetting) {
    invalidSetting.reportValidity();
    invalidSetting.focus();
    toast('Revise o campo destacado antes de salvar.', 'error');
    return;
  }
  state.saving = true;
  updateSaveState('saving');
  const snapshot = normalizePortfolio(deepClone(state.portfolio));
  try {
    const result = await savePortfolio(snapshot);
    const saved = result?.settings ? normalizePortfolio(result) : snapshot;
    state.savedSignature = signature(saved);
    if (signature(state.portfolio) === signature(snapshot)) state.portfolio = saved;
    toast('Alterações salvas e publicadas.', 'success');
    announce('Alterações salvas e publicadas.');
    updateSaveState();
  } catch (error) {
    updateSaveState('error');
    toast(friendlyError(error, 'Não foi possível salvar. Suas alterações continuam neste navegador.'), 'error', 6500);
  } finally {
    state.saving = false;
    updateSaveState();
  }
}

async function handleLogout() {
  if (isDirty()) {
    const confirmed = await requestConfirmation({
      title: 'Sair sem salvar?',
      message: 'As alterações que ainda não foram salvas serão descartadas.',
      action: 'Sair sem salvar'
    });
    if (!confirmed) return;
  }
  try {
    await signOutAdmin();
  } catch (error) {
    toast(friendlyError(error, 'Não foi possível sair agora.'), 'error');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginError.hidden = true;
  if (!elements.loginForm.reportValidity()) return;
  elements.loginSubmit.disabled = true;
  elements.loginSubmit.textContent = 'Entrando…';
  try {
    await signInAdmin(elements.loginEmail.value.trim(), elements.loginPassword.value);
  } catch (error) {
    elements.loginError.textContent = friendlyError(error, 'Não foi possível entrar.');
    elements.loginError.hidden = false;
    elements.loginPassword.select();
  } finally {
    elements.loginSubmit.disabled = false;
    elements.loginSubmit.textContent = 'Entrar';
  }
}

async function handleAuthenticatedUser(user) {
  if (state.authBusy) return;
  state.authBusy = true;
  showOnly('boot');
  try {
    const allowed = await isCurrentUserAdmin(user);
    if (!allowed) {
      await signOutAdmin();
      showOnly('login');
      elements.loginError.textContent = 'Esta conta não tem permissão para acessar o painel.';
      elements.loginError.hidden = false;
      return;
    }

    await seedPortfolio();
    const loaded = await loadPortfolio();
    state.user = user;
    state.portfolio = normalizePortfolio(loaded);
    state.savedSignature = signature(state.portfolio);
    elements.userEmail.textContent = user.email || 'Conta administrativa';
    showOnly('app');
    render();
    await initAdminAssistant();
    state.initialized = true;
  } catch (error) {
    showOnly('login');
    elements.loginError.textContent = friendlyError(error, 'Não foi possível carregar o painel.');
    elements.loginError.hidden = false;
  } finally {
    state.authBusy = false;
  }
}

function handleSignedOut() {
  destroyAdminAssistant();
  state.user = null;
  state.portfolio = null;
  state.savedSignature = '';
  state.initialized = false;
  showOnly('login');
  window.setTimeout(() => elements.loginEmail.focus(), 20);
}

function setupEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.togglePassword.addEventListener('click', () => {
    const showing = elements.loginPassword.type === 'text';
    elements.loginPassword.type = showing ? 'password' : 'text';
    elements.togglePassword.textContent = showing ? 'Mostrar' : 'Ocultar';
    elements.togglePassword.setAttribute('aria-pressed', String(!showing));
    elements.loginPassword.focus();
  });
  elements.openSidebar.addEventListener('click', openSidebar);
  elements.closeSidebar.addEventListener('click', () => closeSidebar({ restoreFocus: true }));
  elements.sidebarScrim.addEventListener('click', () => closeSidebar({ restoreFocus: true }));
  elements.nav.addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (button) navigateSection(button.dataset.section);
  });
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.saveButton.addEventListener('click', saveChanges);

  elements.content.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) handleContentAction(button);
  });
  elements.content.addEventListener('input', event => {
    if (event.target.matches('[data-setting-path]')) handleSettingInput(event.target);
    if (event.target.matches('[data-filter-rows]')) filterRows(event.target);
  });
  elements.content.addEventListener('change', event => {
    if (event.target.matches('[data-color-for]')) {
      const textInput = $(`[data-color-text="${CSS.escape(event.target.dataset.colorFor)}"]`, elements.content);
      if (textInput) {
        textInput.value = event.target.value;
        handleSettingInput(textInput);
      }
    }
  });
  elements.content.addEventListener('dragstart', startDrag);
  elements.content.addEventListener('dragover', dragOver);
  elements.content.addEventListener('drop', dropEntity);
  elements.content.addEventListener('dragend', clearDragState);

  elements.entityForm.addEventListener('submit', commitEntityForm);
  elements.entityForm.addEventListener('click', event => {
    const icon = event.target.closest('[data-icon-id]');
    if (icon) handleIconChoice(icon);
  });
  elements.entityForm.addEventListener('input', event => {
    if (event.target.matches('[data-icon-search]')) filterIcons(event.target);
  });
  elements.entityForm.addEventListener('change', event => {
    if (event.target.matches('[data-entity-color-for]')) syncEntityColor(event.target);
  });
  elements.githubForm.addEventListener('submit', handleGitHubSubmit);

  document.addEventListener('change', event => {
    const input = event.target.closest('[data-media-upload], [data-dialog-upload]');
    if (input) handleUpload(input);
  });
  document.addEventListener('click', event => {
    const fileButton = event.target.closest('[data-file-target]');
    if (fileButton) document.getElementById(fileButton.dataset.fileTarget)?.click();
    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeDialog(document.getElementById(closeButton.dataset.closeDialog));
  });

  [elements.entityDialog, elements.githubDialog].forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('is-dialog-open', $$('dialog[open]').length > 0);
      if (dialog === elements.entityDialog) state.editing = null;
      if (dialog === elements.githubDialog) state.githubCandidate = null;
    });
  });
  elements.confirmDialog.addEventListener('cancel', event => {
    event.preventDefault();
    resolveConfirmation(false);
  });
  elements.confirmCancel.addEventListener('click', () => resolveConfirmation(false));
  elements.confirmAccept.addEventListener('click', () => resolveConfirmation(true));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.app.classList.contains('is-sidebar-open')) closeSidebar({ restoreFocus: true });
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !elements.app.hidden) {
      event.preventDefault();
      saveChanges();
    }
  });
  window.addEventListener('beforeunload', event => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function start() {
  setupEvents();
  if (!configured()) {
    showOnly('setup');
    return;
  }

  watchAuth(user => {
    if (user) handleAuthenticatedUser(user);
    else if (!state.authBusy) handleSignedOut();
  });
}

start();
