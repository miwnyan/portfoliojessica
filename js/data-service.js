import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import { auth, db, firebaseConfigured } from './firebase.js';
import { DEFAULT_PORTFOLIO, cloneDefaultPortfolio } from './default-data.js';

const PORTFOLIO_COLLECTION = 'portfolio';
const PORTFOLIO_DOCUMENT = 'public';
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_RADIUS = /^\d+(?:\.\d+)?(?:px|rem|em|%)$/i;

const SETTINGS_TEXT_LIMITS = Object.freeze({
  meta: {
    title: 100,
    description: 500,
    ogTitle: 120,
    ogDescription: 500
  },
  navigation: { home: 80, about: 80, projects: 80, contact: 80 },
  hero: {
    eyebrow: 160,
    intro: 200,
    name: 160,
    subtitle: 240,
    description: 1000,
    primaryLabel: 160,
    secondaryLabel: 160
  },
  about: { title: 200, bunnyAlt: 400 },
  sections: {
    skillsTitle: 200,
    skillsIntro: 1000,
    experienceTitle: 200,
    projectsTitle: 200,
    projectsIntro: 1000,
    contactTitle: 200
  },
  contact: {
    formTitle: 200,
    nameLabel: 120,
    emailLabel: 120,
    messageLabel: 120,
    submitLabel: 160,
    infoTitle: 200,
    infoText: 2000,
    socialTitle: 200
  },
  footer: {
    name: 200,
    tagline: 500,
    backLabel: 160,
    copyrightName: 200,
    credit: 500
  },
  ui: {
    skipToContentLabel: 200,
    menuOpenLabel: 200,
    menuCloseLabel: 200,
    folderOpenLabel: 200,
    folderCloseLabel: 200,
    folderMoreLabel: 200,
    folderLessLabel: 200,
    experienceExpandLabel: 240,
    experienceCollapseLabel: 240,
    projectDetailsLabel: 200,
    projectRepositoryLabel: 200,
    projectRepositoryTitle: 240,
    projectHomepageLabel: 200,
    projectHomepageTitle: 240,
    contactMissingEmail: 1500,
    contactOpeningEmail: 1500,
    skillDialogCloseLabel: 200,
    projectDialogCloseLabel: 200
  }
});

export class DataServiceError extends Error {
  constructor(message, code = 'data-service/error', cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'DataServiceError';
    this.code = code;
  }
}

const isPlainObject = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const cleanText = (value, fallback = '', maxLength = 5000) => {
  if (typeof value !== 'string') return fallback;
  return value.replace(CONTROL_CHARACTERS, '').slice(0, maxLength);
};

const cleanTrimmedText = (value, fallback = '', maxLength = 500) =>
  cleanText(value, fallback, maxLength).trim();

const cleanBoolean = (value, fallback = true) =>
  typeof value === 'boolean' ? value : fallback;

const cleanNumber = (value, fallback = 0, minimum = -1_000_000, maximum = 1_000_000) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
};

const slugify = value => cleanTrimmedText(value, '', 80)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

function uniqueId(value, prefix, index, usedIds) {
  const requested = cleanTrimmedText(value, '', 80).toLowerCase();
  const base = SAFE_ID.test(requested)
    ? requested
    : slugify(requested) || `${prefix}-${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${base.slice(0, 73)}-${suffix++}`;
  usedIds.add(candidate);
  return candidate;
}

function cleanStringList(value, fallback = [], limit = 50, itemLength = 240) {
  if (!Array.isArray(value)) return [...fallback];
  const result = [];
  value.slice(0, limit).forEach(item => {
    const text = cleanTrimmedText(item, '', itemLength);
    if (text && !result.includes(text)) result.push(text);
  });
  return result;
}

function cleanUrl(value, fallback = '', { allowAnchor = false, allowMail = false, allowLocal = true } = {}) {
  const url = cleanTrimmedText(value, fallback, 2048);
  if (!url) return '';
  if (allowAnchor && /^#[A-Za-z][\w:.-]*$/.test(url)) return url;
  if (allowLocal && (/^\/(?!\/)/.test(url) || /^assets\//i.test(url))) return url;
  if (allowMail && /^(?:mailto|tel):[^\s]+$/i.test(url)) return url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function mergeByTemplate(template, incoming) {
  if (typeof template === 'string') return cleanText(incoming, template);
  if (typeof template === 'boolean') return cleanBoolean(incoming, template);
  if (typeof template === 'number') return cleanNumber(incoming, template);
  if (Array.isArray(template)) {
    const stringsOnly = template.every(item => typeof item === 'string');
    return stringsOnly ? cleanStringList(incoming, template) : [...template];
  }
  if (!isPlainObject(template)) return template;

  const source = isPlainObject(incoming) ? incoming : {};
  return Object.fromEntries(
    Object.entries(template).map(([key, fallback]) => [key, mergeByTemplate(fallback, source[key])])
  );
}

function normalizeSettings(value) {
  const normalized = mergeByTemplate(DEFAULT_PORTFOLIO.settings, value);
  const incoming = isPlainObject(value) ? value : {};
  const incomingMeta = isPlainObject(incoming.meta) ? incoming.meta : {};
  const incomingAbout = isPlainObject(incoming.about) ? incoming.about : {};
  const incomingTheme = isPlainObject(incoming.theme) ? incoming.theme : {};

  Object.entries(SETTINGS_TEXT_LIMITS).forEach(([section, fields]) => {
    const sectionInput = isPlainObject(incoming[section]) ? incoming[section] : {};
    Object.entries(fields).forEach(([field, maximum]) => {
      normalized[section][field] = cleanText(
        sectionInput[field],
        DEFAULT_PORTFOLIO.settings[section][field],
        maximum
      );
    });
  });

  normalized.about.paragraphs = cleanStringList(
    incomingAbout.paragraphs,
    DEFAULT_PORTFOLIO.settings.about.paragraphs,
    50,
    2000
  );
  normalized.contact.services = cleanStringList(
    incoming.contact?.services,
    DEFAULT_PORTFOLIO.settings.contact.services,
    50,
    240
  );
  normalized.contact.destinationEmail = cleanTrimmedText(
    incoming.contact?.destinationEmail,
    DEFAULT_PORTFOLIO.settings.contact.destinationEmail,
    320
  );

  normalized.meta.faviconUrl = cleanUrl(
    incomingMeta.faviconUrl,
    DEFAULT_PORTFOLIO.settings.meta.faviconUrl
  );
  normalized.about.bunnyAnimatedUrl = cleanUrl(
    incomingAbout.bunnyAnimatedUrl,
    DEFAULT_PORTFOLIO.settings.about.bunnyAnimatedUrl
  );
  normalized.about.bunnyStaticUrl = cleanUrl(
    incomingAbout.bunnyStaticUrl,
    DEFAULT_PORTFOLIO.settings.about.bunnyStaticUrl
  );
  Object.keys(DEFAULT_PORTFOLIO.settings.theme).forEach(key => {
    const fallback = DEFAULT_PORTFOLIO.settings.theme[key];
    const candidate = cleanTrimmedText(incomingTheme[key], fallback, 32);
    normalized.theme[key] = key === 'radius'
      ? (SAFE_RADIUS.test(candidate) ? candidate : fallback)
      : (SAFE_COLOR.test(candidate) ? candidate.toLowerCase() : fallback);
  });

  normalized.meta.themeColor = SAFE_COLOR.test(normalized.meta.themeColor)
    ? normalized.meta.themeColor.toLowerCase()
    : normalized.theme.bg;
  normalized.ui.experienceCollapsedCount = Math.round(cleanNumber(
    incoming.ui?.experienceCollapsedCount,
    DEFAULT_PORTFOLIO.settings.ui.experienceCollapsedCount,
    1,
    50
  ));
  return normalized;
}

function normalizeEntities(value, fallback, prefix, mapper, maximum = 500) {
  const hasRemoteArray = Array.isArray(value);
  const source = hasRemoteArray ? value : fallback;
  const fallbackById = new Map(fallback.map(item => [String(item.id).toLowerCase(), item]));
  const usedIds = new Set();
  return source
    .slice(0, maximum)
    .map((rawValue, index) => {
      const raw = isPlainObject(rawValue) ? rawValue : {};
      const fallbackValue = hasRemoteArray
        ? (fallbackById.get(String(raw.id || '').toLowerCase()) || {})
        : (fallback[index] || {});
      const id = uniqueId(raw.id ?? fallbackValue.id, prefix, index, usedIds);
      return mapper(raw, fallbackValue, id, index);
    })
    .sort((left, right) => left.order - right.order);
}

const entityBasics = (raw, fallback, id, index) => ({
  id,
  order: cleanNumber(raw.order, fallback.order ?? index, -100_000, 100_000),
  visible: cleanBoolean(raw.visible, fallback.visible ?? true)
});

function normalizeProjects(value) {
  const previousDefaultIds = new Set(['cafeteria', 'sysdaisy', 'lastro', 'nexo', 'cirro', 'prumo']);
  const isPreviousDefaultPortfolio = Array.isArray(value)
    && value.length > 0
    && value.length < DEFAULT_PORTFOLIO.projects.length
    && value.every(project => previousDefaultIds.has(String(project?.id || '').toLowerCase()));
  const source = isPreviousDefaultPortfolio ? undefined : value;
  return normalizeEntities(source, DEFAULT_PORTFOLIO.projects, 'project', (raw, fallback, id, index) => {
    const githubInput = isPlainObject(raw.github) ? raw.github : {};
    const githubFallback = isPlainObject(fallback.github) ? fallback.github : {};
    return {
      ...entityBasics(raw, fallback, id, index),
      name: cleanTrimmedText(raw.name ?? raw.nome, fallback.name || 'Projeto sem título', 160),
      summary: cleanText(raw.summary ?? raw.resumo, fallback.summary || '', 800).trim(),
      description: cleanText(raw.description ?? raw.descricao, fallback.description || '', 10_000).trim(),
      technologies: cleanStringList(raw.technologies ?? raw.tecnologias, fallback.technologies || [], 30, 80),
      coverUrl: cleanUrl(raw.coverUrl ?? raw.capa, fallback.coverUrl || ''),
      coverPublicId: cleanTrimmedText(raw.coverPublicId, fallback.coverPublicId || '', 255),
      repositoryUrl: cleanUrl(raw.repositoryUrl ?? raw.repositorio, fallback.repositoryUrl || '', { allowLocal: false }),
      homepageUrl: cleanUrl(raw.homepageUrl, fallback.homepageUrl || '', { allowLocal: false }),
      source: ['github', 'manual'].includes(raw.source) ? raw.source : (fallback.source || 'manual'),
      github: {
        owner: cleanTrimmedText(githubInput.owner, githubFallback.owner || '', 80),
        repo: cleanTrimmedText(githubInput.repo, githubFallback.repo || '', 120),
        fullName: cleanTrimmedText(githubInput.fullName, githubFallback.fullName || '', 220),
        defaultBranch: cleanTrimmedText(githubInput.defaultBranch, githubFallback.defaultBranch || '', 220),
        language: cleanTrimmedText(githubInput.language, githubFallback.language || '', 100),
        topics: cleanStringList(githubInput.topics, githubFallback.topics || [], 30, 80)
      }
    };
  }, 100);
}

function normalizeExperiences(value) {
  return normalizeEntities(value, DEFAULT_PORTFOLIO.experiences, 'experience', (raw, fallback, id, index) => ({
    ...entityBasics(raw, fallback, id, index),
    period: cleanTrimmedText(raw.period, fallback.period || '', 80),
    startDate: cleanTrimmedText(raw.startDate, fallback.startDate || '', 32),
    endDate: cleanTrimmedText(raw.endDate, fallback.endDate || '', 32),
    title: cleanTrimmedText(raw.title, fallback.title || 'Experiência', 200),
    institution: cleanTrimmedText(raw.institution, fallback.institution || '', 200),
    description: cleanText(raw.description, fallback.description || '', 5000).trim()
  }), 100);
}

function normalizeFolders(value) {
  return normalizeEntities(value, DEFAULT_PORTFOLIO.folders, 'folder', (raw, fallback, id, index) => {
    const color = cleanTrimmedText(raw.color, fallback.color || '#d991ba', 16);
    const colorDeep = cleanTrimmedText(raw.colorDeep, fallback.colorDeep || '#8f5578', 16);
    return {
      ...entityBasics(raw, fallback, id, index),
      name: cleanTrimmedText(raw.name, fallback.name || 'Pasta', 160),
      color: SAFE_COLOR.test(color) ? color.toLowerCase() : (fallback.color || '#d991ba'),
      colorDeep: SAFE_COLOR.test(colorDeep) ? colorDeep.toLowerCase() : (fallback.colorDeep || '#8f5578'),
      openByDefault: cleanBoolean(raw.openByDefault, fallback.openByDefault ?? true)
    };
  }, 50);
}

function normalizeSkills(value, folderIds) {
  const firstFolderId = folderIds.values().next().value || '';
  return normalizeEntities(value, DEFAULT_PORTFOLIO.skills, 'skill', (raw, fallback, id, index) => {
    const requestedFolderId = cleanTrimmedText(raw.folderId, fallback.folderId || firstFolderId, 80).toLowerCase();
    return {
      ...entityBasics(raw, fallback, id, index),
      folderId: folderIds.has(requestedFolderId) ? requestedFolderId : firstFolderId,
      name: cleanTrimmedText(raw.name, fallback.name || 'Habilidade', 160),
      title: cleanTrimmedText(raw.title, fallback.title || raw.name || fallback.name || 'Habilidade', 240),
      badge: cleanTrimmedText(raw.badge, fallback.badge || '', 100),
      status: cleanTrimmedText(raw.status, fallback.status || '', 180),
      iconId: cleanTrimmedText(raw.iconId, fallback.iconId || 'code', 80),
      iconUrl: cleanUrl(raw.iconUrl, fallback.iconUrl || '/assets/icons/code.svg'),
      certificateUrl: cleanUrl(raw.certificateUrl, fallback.certificateUrl || ''),
      description: cleanText(raw.description, fallback.description || '', 5000).trim(),
      details: cleanStringList(raw.details, fallback.details || [], 20, 500)
    };
  });
}

function normalizeContacts(value) {
  return normalizeEntities(value, DEFAULT_PORTFOLIO.contacts, 'contact', (raw, fallback, id, index) => {
    const type = ['external', 'anchor', 'email', 'phone'].includes(raw.type)
      ? raw.type
      : (fallback.type || 'external');
    const rawDestination = cleanTrimmedText(raw.url, fallback.url || '', 2048);
    const destination = type === 'email' && rawDestination && !/^mailto:/i.test(rawDestination)
      ? `mailto:${rawDestination}`
      : type === 'phone' && rawDestination && !/^tel:/i.test(rawDestination)
        ? `tel:${rawDestination}`
        : rawDestination;

    return {
      ...entityBasics(raw, fallback, id, index),
      type,
      label: cleanTrimmedText(raw.label, fallback.label || 'Contato', 100),
      url: cleanUrl(destination, fallback.url || '', { allowAnchor: true, allowMail: true }),
      iconId: cleanTrimmedText(raw.iconId, fallback.iconId || 'mail', 80),
      iconUrl: cleanUrl(raw.iconUrl, fallback.iconUrl || ''),
      ariaLabel: cleanTrimmedText(raw.ariaLabel, fallback.ariaLabel || raw.label || 'Contato', 180),
      title: cleanTrimmedText(raw.title, fallback.title || raw.label || 'Contato', 100)
    };
  }, 100);
}

/**
 * Converte dados externos/legados em um documento pequeno, previsível e sem
 * campos HTML executáveis. O renderer ainda deve sempre usar textContent.
 */
export function normalizePortfolio(value) {
  const source = isPlainObject(value) ? value : {};
  const folders = normalizeFolders(source.folders);
  const folderIds = new Set(folders.map(folder => folder.id));

  return {
    schemaVersion: Math.max(1, Math.round(cleanNumber(source.schemaVersion, DEFAULT_PORTFOLIO.schemaVersion, 1, 1000))),
    settings: normalizeSettings(source.settings),
    projects: normalizeProjects(source.projects),
    experiences: normalizeExperiences(source.experiences),
    folders,
    skills: normalizeSkills(source.skills, folderIds),
    contacts: normalizeContacts(source.contacts)
  };
}

const portfolioReference = () => {
  if (!db) throw new DataServiceError('Firebase não está configurado.', 'firebase/not-configured');
  return doc(db, PORTFOLIO_COLLECTION, PORTFOLIO_DOCUMENT);
};

async function requireAdministrator(user = auth?.currentUser) {
  if (!user) throw new DataServiceError('Faça login para continuar.', 'auth/required');
  if (!await currentUserIsAdmin(user)) {
    throw new DataServiceError('Esta conta não tem acesso administrativo.', 'auth/not-admin');
  }
  return user;
}

export function observeAuth(callback, onError) {
  if (typeof callback !== 'function') {
    throw new TypeError('observeAuth requer uma função de callback.');
  }
  if (!auth) {
    queueMicrotask(() => callback(null));
    return () => {};
  }
  return onAuthStateChanged(auth, callback, onError);
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new DataServiceError('Firebase não está configurado.', 'firebase/not-configured');
  const normalizedEmail = cleanTrimmedText(email, '', 320).toLowerCase();
  if (!normalizedEmail || typeof password !== 'string' || !password) {
    throw new DataServiceError('Informe e-mail e senha.', 'auth/missing-credentials');
  }
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  return credential.user;
}

export async function logout() {
  if (auth) await signOut(auth);
}

export async function currentUserIsAdmin(user = auth?.currentUser) {
  if (!db || !user?.uid) return false;
  try {
    const snapshot = await getDoc(doc(db, 'admins', user.uid));
    if (!snapshot.exists()) return false;
    const data = snapshot.data();
    return data?.active === true && data?.disabled !== true;
  } catch (error) {
    const firebaseCode = cleanTrimmedText(error?.code, 'unknown', 100);
    throw new DataServiceError(
      `Não foi possível consultar a permissão administrativa (${firebaseCode}).`,
      'admin/access-check-failed',
      error
    );
  }
}

/**
 * Carrega o documento público. Ausência de configuração, documento ou rede
 * retorna uma cópia independente do conteúdo inicial para o site não quebrar.
 */
export async function loadPortfolio() {
  if (!firebaseConfigured || !db) return cloneDefaultPortfolio();
  try {
    const snapshot = await getDoc(portfolioReference());
    return snapshot.exists()
      ? normalizePortfolio(snapshot.data())
      : cloneDefaultPortfolio();
  } catch {
    return cloneDefaultPortfolio();
  }
}

export function subscribePortfolio(callback, onError) {
  if (typeof callback !== 'function') {
    throw new TypeError('subscribePortfolio requer uma função de callback.');
  }
  if (!firebaseConfigured || !db) {
    queueMicrotask(() => callback(cloneDefaultPortfolio()));
    return () => {};
  }

  return onSnapshot(
    portfolioReference(),
    snapshot => callback(snapshot.exists() ? normalizePortfolio(snapshot.data()) : cloneDefaultPortfolio()),
    error => {
      callback(cloneDefaultPortfolio());
      if (typeof onError === 'function') onError(error);
    }
  );
}

export async function ensurePortfolioSeeded() {
  await requireAdministrator();
  const reference = portfolioReference();
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) return normalizePortfolio(snapshot.data());

  const initialData = cloneDefaultPortfolio();
  await setDoc(reference, {
    ...initialData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return initialData;
}

export async function savePortfolio(value) {
  await requireAdministrator();
  const normalized = normalizePortfolio(value);
  const reference = portfolioReference();
  const existing = await getDoc(reference);
  const existingCreatedAt = existing.exists() ? existing.data()?.createdAt : null;
  await setDoc(reference, {
    ...normalized,
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return normalized;
}

// Aliases semânticos para consumidores que preferem nomes orientados ao admin.
export const watchAuth = observeAuth;
export const signInAdmin = loginWithEmail;
export const signOutAdmin = logout;
export const isCurrentUserAdmin = currentUserIsAdmin;
export const seedPortfolio = ensurePortfolioSeeded;

export { firebaseConfigured };

