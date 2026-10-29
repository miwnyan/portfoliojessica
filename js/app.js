import { DEFAULT_PORTFOLIO, cloneDefaultPortfolio } from './default-data.js';
import { renderProjectsCarousel } from './projects-carousel.jsx';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  data: cloneDefaultPortfolio(),
  expandedExperiences: false,
  openFolders: new Set(),
  expandedFolders: new Set(),
  activeSkillTrigger: null,
  typingStarted: false
};

const byId = id => document.getElementById(id);
const text = (id, value = '') => {
  const element = byId(id);
  if (element) element.textContent = String(value ?? '');
};
const visibleOrdered = items => (Array.isArray(items) ? items : [])
  .filter(item => item && item.visible !== false)
  .slice()
  .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

const THEME_VARS = {
  bg: '--bg', bgAlt: '--bg-alt', panel: '--panel', panelDark: '--panel-dark',
  border: '--border', borderSoft: '--border-soft', accent: '--accent',
  accentLight: '--accent-light', accentDeep: '--accent-deep', text: '--text',
  muted: '--muted', radius: '--radius'
};

const SOCIAL_ICONS = {
  github: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-4.3 1.5-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.94-2.65c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.7 5.07 5.07 0 0 0 18.91 1S17.73.65 15 3a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.7a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.4 3.4 0 0 0 8 18.1V22" transform="translate(1.5 1) scale(.88)"/></svg>',
  linkedin: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-7m0 3.2a3.2 3.2 0 0 1 6.4 0V17"/></svg>',
  email: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></svg>',
  website: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  phone: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"/></svg>',
  link: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
};

function safeHref(value, fallback = '#') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('#') && /^#[A-Za-z][\w:-]*$/.test(raw)) return raw;
  try {
    const url = new URL(raw, window.location.href);
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return raw;
  } catch { return fallback; }
  return fallback;
}

function safeImage(value, fallback) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (/^(?:\.?\.?\/|\/)?assets\//i.test(raw)) return raw;
  try {
    const url = new URL(raw, window.location.href);
    if (['https:', 'http:'].includes(url.protocol)) return raw;
  } catch { return fallback; }
  return fallback;
}

function setMeta(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute('content', String(value));
}

function applyTheme(theme = {}) {
  for (const [key, cssVariable] of Object.entries(THEME_VARS)) {
    const value = theme[key];
    if (typeof value === 'string' && value.trim()) {
      document.documentElement.style.setProperty(cssVariable, value.trim());
    }
  }
}

function applySettings(settings = {}) {
  const meta = settings.meta || {};
  const navigation = settings.navigation || {};
  const hero = settings.hero || {};
  const about = settings.about || {};
  const sections = settings.sections || {};
  const contact = settings.contact || {};
  const footer = settings.footer || {};
  const ui = settings.ui || {};

  document.title = meta.title || DEFAULT_PORTFOLIO.settings.meta.title;
  setMeta('meta[name="description"]', meta.description);
  setMeta('meta[property="og:title"]', meta.ogTitle || meta.title);
  setMeta('meta[property="og:description"]', meta.ogDescription || meta.description);
  setMeta('meta[name="theme-color"]', meta.themeColor || settings.theme?.bg);
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = safeImage(meta.faviconUrl, 'assets/favicon.svg');

  text('brand-name', hero.name || footer.copyrightName || 'Jéssica');
  byId('brand-link')?.setAttribute('aria-label', `${hero.name || 'Jéssica'} - início`);
  textIn('[data-nav="home"]', navigation.home || 'Início');
  textIn('[data-nav="about"]', navigation.about || 'Sobre');
  textIn('[data-nav="projects"]', navigation.projects || 'Projetos');
  textIn('[data-nav="contact"]', navigation.contact || 'Contato');

  text('hero-eyebrow', hero.eyebrow);
  text('hero-subtitle', hero.subtitle);
  text('hero-description', hero.description);
  text('hero-primary', hero.primaryLabel);
  text('hero-secondary', hero.secondaryLabel);
  const typedIntro = byId('typed-hero');
  const typedName = byId('typed-name');
  if (typedIntro) typedIntro.dataset.text = hero.intro || '';
  if (typedName) typedName.dataset.text = hero.name || '';
  document.querySelector('.hero-title')?.setAttribute('aria-label', `${hero.intro || ''}${hero.name || ''}`.trim());
  if (state.typingStarted) {
    if (typedIntro) typedIntro.textContent = hero.intro || '';
    if (typedName) {
      typedName.textContent = hero.name || '';
      typedName.classList.add('typing-complete');
    }
  }

  text('about-title', about.title);
  const aboutParagraphs = byId('about-paragraphs');
  if (aboutParagraphs) {
    aboutParagraphs.replaceChildren(...(Array.isArray(about.paragraphs) ? about.paragraphs : []).map(value => {
      const paragraph = document.createElement('p');
      paragraph.textContent = String(value);
      return paragraph;
    }));
  }
  const bunny = byId('bunny-image');
  if (bunny) {
    bunny.src = safeImage(about.bunnyAnimatedUrl, 'assets/coelhinho.gif');
    bunny.alt = about.bunnyAlt || 'Coelhinho rosa em pixel art';
  }
  const bunnyStatic = byId('bunny-static');
  if (bunnyStatic) bunnyStatic.srcset = safeImage(about.bunnyStaticUrl, 'assets/coelhinho-estatico.png');

  text('skills-title', sections.skillsTitle);
  text('skills-intro', sections.skillsIntro);
  text('experience-title', sections.experienceTitle);
  text('projects-title', sections.projectsTitle);
  text('projects-intro', sections.projectsIntro);
  text('contact-title', sections.contactTitle);
  text('contact-form-title', contact.formTitle);
  text('contact-name-label', contact.nameLabel);
  text('contact-email-label', contact.emailLabel);
  text('contact-message-label', contact.messageLabel);
  text('contact-submit', contact.submitLabel);
  text('contact-info-title', contact.infoTitle);
  text('contact-info-text', contact.infoText);
  text('social-title', contact.socialTitle);
  const serviceList = byId('contact-services');
  if (serviceList) {
    serviceList.replaceChildren(...(Array.isArray(contact.services) ? contact.services : []).map(value => {
      const item = document.createElement('li');
      item.textContent = String(value);
      return item;
    }));
  }

  text('footer-name', footer.name);
  text('footer-tagline', footer.tagline);
  text('footer-copyright', footer.copyrightName);
  text('footer-credit', footer.credit);
  const footerBack = byId('footer-back');
  if (footerBack) {
    footerBack.replaceChildren(document.createTextNode(`${footer.backLabel || 'Voltar ao início'} `));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↑';
    footerBack.appendChild(arrow);
  }
  textIn('.skip-link', ui.skipToContentLabel || 'Ir para o conteúdo');
  const menuToggle = byId('menu-toggle');
  if (menuToggle && menuToggle.getAttribute('aria-expanded') !== 'true') {
    menuToggle.setAttribute('aria-label', ui.menuOpenLabel || 'Abrir menu');
  }
  byId('skill-modal-close')?.setAttribute('aria-label', ui.skillDialogCloseLabel || 'Fechar detalhes');
  byId('modal-close')?.setAttribute('aria-label', ui.projectDialogCloseLabel || 'Fechar detalhes');
  applyTheme(settings.theme);
}

function textIn(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = String(value ?? '');
}

function labelWithCount(label, count) {
  const value = String(label || '').trim();
  if (value.includes('{count}')) return value.replace('{count}', String(count));
  return count > 0 ? `${value} (${count})` : value;
}

function createImageIcon(src, fallback = 'assets/icons/code.svg') {
  const image = document.createElement('img');
  image.src = safeImage(src, fallback);
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    if (!image.dataset.fallbackApplied) {
      image.dataset.fallbackApplied = 'true';
      image.src = fallback;
    }
  });
  return image;
}

function renderFolders() {
  const grid = byId('skills-grid');
  if (!grid) return;
  const folders = visibleOrdered(state.data.folders);
  const skills = visibleOrdered(state.data.skills);
  const ui = state.data.settings?.ui || {};
  const nodes = folders.map(folder => {
    const folderSkills = skills.filter(skill => skill.folderId === folder.id);
    const isOpen = state.openFolders.has(folder.id);
    const isExpanded = state.expandedFolders.has(folder.id);
    const extraRows = Math.max(0, Math.ceil(folderSkills.length / 2) - 3);
    const article = document.createElement('article');
    article.className = `skill-folder stagger-item${isOpen ? ' is-open' : ''}${isExpanded ? ' is-expanded' : ''}`;
    article.dataset.folderId = folder.id;
    article.style.setProperty('--folder-color', folder.color || '#d991ba');
    article.style.setProperty('--folder-color-deep', folder.colorDeep || '#8f5578');
    const extraHeight = isOpen && folderSkills.length > 6
      ? 42 + (isExpanded ? extraRows * 62 : 0)
      : 0;
    article.style.setProperty('--folder-extra-height', `${extraHeight}px`);

    const shell = document.createElement('div');
    shell.className = 'folder-shell';
    const back = document.createElement('div');
    back.className = 'folder-back';
    back.setAttribute('aria-hidden', 'true');
    const backTitle = document.createElement('span');
    backTitle.textContent = folder.name || 'Pasta';
    back.appendChild(backTitle);

    const panelId = `folder-${String(folder.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const titleId = `${panelId}-title`;
    const paper = document.createElement('div');
    paper.id = panelId;
    paper.className = 'folder-paper';
    paper.setAttribute('role', 'region');
    paper.setAttribute('aria-labelledby', titleId);
    paper.setAttribute('aria-hidden', String(!isOpen));
    paper.inert = !isOpen;
    const list = document.createElement('ul');
    list.className = 'folder-skills';

    folderSkills.forEach((skill, index) => {
      const item = document.createElement('li');
      if (index >= 6 && !isExpanded) item.hidden = true;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `skill-chip${/aprend|estud/i.test(skill.status || '') ? ' is-learning' : ''}`;
      button.dataset.skillId = skill.id;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label', `Ver detalhes sobre ${skill.name}`);
      button.appendChild(createImageIcon(skill.iconUrl));
      const label = document.createElement('span');
      label.appendChild(document.createTextNode(skill.name || 'Habilidade'));
      const badge = skill.badge || '';
      if (badge) {
        const small = document.createElement('small');
        small.textContent = badge;
        label.appendChild(small);
      }
      button.appendChild(label);
      item.appendChild(button);
      list.appendChild(item);
    });

    if (folderSkills.length > 6) {
      const moreItem = document.createElement('li');
      moreItem.className = 'folder-more-item';
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'folder-more';
      more.dataset.folderMore = folder.id;
      more.setAttribute('aria-expanded', String(isExpanded));
      const label = isExpanded ? (ui.folderLessLabel || 'Mostrar menos') : (ui.folderMoreLabel || 'Ver mais {count}');
      more.textContent = isExpanded ? label : labelWithCount(label, folderSkills.length - 6);
      moreItem.appendChild(more);
      list.appendChild(moreItem);
    }
    paper.appendChild(list);

    const cover = document.createElement('button');
    cover.type = 'button';
    cover.className = 'folder-cover';
    cover.dataset.folderToggle = folder.id;
    cover.setAttribute('aria-expanded', String(isOpen));
    cover.setAttribute('aria-controls', panelId);
    const coverTitle = document.createElement('span');
    coverTitle.id = titleId;
    coverTitle.className = 'folder-cover-title';
    coverTitle.textContent = folder.name || 'Pasta';
    const action = document.createElement('span');
    action.className = 'folder-action';
    const actionText = document.createElement('span');
    actionText.textContent = isOpen ? (ui.folderCloseLabel || 'Fechar pasta') : (ui.folderOpenLabel || 'Abrir pasta');
    action.appendChild(actionText);
    action.insertAdjacentHTML('beforeend', '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 12.5 5-5 5 5"/></svg>');
    cover.append(coverTitle, action);
    shell.append(back, paper, cover);
    article.appendChild(shell);
    return article;
  });
  grid.replaceChildren(...nodes);
}

function renderExperiences() {
  const timeline = byId('experience-timeline');
  const toggle = byId('experience-toggle');
  if (!timeline || !toggle) return;
  const experiences = visibleOrdered(state.data.experiences);
  const ui = state.data.settings?.ui || {};
  const initialCount = Math.max(1, Number(ui.experienceCollapsedCount || ui.experienceInitialCount || 2));
  const nodes = experiences.map((experience, index) => {
    const article = document.createElement('article');
    article.className = 'timeline-item stagger-item';
    if (!state.expandedExperiences && index >= initialCount) article.hidden = true;
    const date = document.createElement('span');
    date.className = 'timeline-year';
    date.textContent = experience.period || experience.date || '';
    const card = document.createElement('div');
    card.className = 'timeline-card hover-rise';
    const heading = document.createElement('h4');
    heading.textContent = experience.title || '';
    const place = document.createElement('p');
    place.className = 'timeline-place';
    place.textContent = experience.institution || '';
    const description = document.createElement('p');
    description.textContent = experience.description || '';
    card.append(heading, place, description);
    article.append(date, card);
    return article;
  });
  timeline.replaceChildren(...nodes);
  const hiddenCount = Math.max(0, experiences.length - initialCount);
  toggle.hidden = hiddenCount === 0;
  toggle.setAttribute('aria-expanded', String(state.expandedExperiences));
  const label = state.expandedExperiences
    ? (ui.experienceCollapseLabel || 'Mostrar menos')
    : (ui.experienceExpandLabel || 'Ver mais experiências ({count})');
  toggle.textContent = state.expandedExperiences ? label : labelWithCount(label, hiddenCount);
}

function addTags(parent, tags) {
  if (!parent) return;
  parent.replaceChildren();
  (Array.isArray(tags) ? tags : []).forEach(label => {
    const tag = document.createElement('span');
    tag.textContent = String(label);
    parent.appendChild(tag);
  });
}

function renderProjects() {
  const grid = byId('projects-grid');
  if (!grid) return;
  const projects = visibleOrdered(state.data.projects);
  renderProjectsCarousel(grid, projects, openProject);
}
function renderContacts() {
  const socialContainer = byId('social-links');
  const footerContainer = byId('footer-links');
  if (!socialContainer || !footerContainer) return;
  const socialLinks = [];
  const footerLinks = [];
  visibleOrdered(state.data.contacts).forEach(contact => {
    const href = safeHref(contact.url, '');
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.title = contact.title || contact.label || 'Link';
    link.setAttribute('aria-label', contact.ariaLabel || contact.label || 'Abrir link');
    if (contact.newTab !== false && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    if (contact.iconUrl) link.appendChild(createImageIcon(contact.iconUrl));
    else {
      const key = contact.iconKey || contact.iconId;
      const normalizedKey = key === 'github-contact' ? 'github' : key === 'mail' ? 'email' : key;
      link.innerHTML = SOCIAL_ICONS[normalizedKey] || SOCIAL_ICONS.link;
    }
    socialLinks.push(link);

    if (contact.showInFooter !== false && !href.startsWith('#')) {
      const footerLink = document.createElement('a');
      footerLink.href = href;
      footerLink.textContent = `${contact.label || 'Link'} `;
      if (link.target) {
        footerLink.target = '_blank';
        footerLink.rel = 'noopener noreferrer';
      }
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      footerLink.appendChild(arrow);
      footerLinks.push(footerLink);
    }
  });
  socialContainer.replaceChildren(...socialLinks);
  footerContainer.replaceChildren(...footerLinks);
}

function renderPortfolio(data, { resetFolderState = false } = {}) {
  state.data = data || cloneDefaultPortfolio();
  if (resetFolderState) {
    state.openFolders = new Set(
      visibleOrdered(state.data.folders)
        .filter(folder => folder.openByDefault !== false)
        .map(folder => folder.id)
    );
    state.expandedFolders.clear();
  }
  applySettings(state.data.settings || {});
  renderFolders();
  renderExperiences();
  renderProjects();
  renderContacts();
  text('year', new Date().getFullYear());
  refreshRevealElements();
}

function openProject(projectId) {
  const project = (state.data.projects || []).find(item => item.id === projectId);
  const dialog = byId('project-dialog');
  if (!project || !dialog) return;
  const projectName = project.name || project.nome || '';
  text('modal-title', projectName);
  text('modal-description', project.description || project.descricao);
  const image = byId('modal-cover');
  if (image) {
    image.src = safeImage(project.coverUrl || project.cover || project.capa, 'assets/projects/lastro-preview.png');
    image.alt = project.coverAlt || `Capa do projeto ${projectName}`;
  }
  addTags(byId('modal-tags'), project.technologies || project.tecnologias);
  const link = byId('modal-link');
  const href = safeHref(project.repositoryUrl || project.repository || project.repositorio, '');
  if (link) {
    link.href = href || '#';
    link.hidden = !href;
    link.textContent = state.data.settings?.ui?.projectRepositoryLabel || 'Ver no GitHub';
    link.title = state.data.settings?.ui?.projectRepositoryTitle || 'Abrir repositório';
  }
  const homepageLink = byId('modal-homepage');
  const homepage = safeHref(project.homepageUrl, '');
  if (homepageLink) {
    homepageLink.href = homepage || '#';
    homepageLink.hidden = !homepage;
    homepageLink.textContent = state.data.settings?.ui?.projectHomepageLabel || 'Visitar projeto';
    homepageLink.title = state.data.settings?.ui?.projectHomepageTitle || 'Abrir projeto publicado';
  }
  dialog.showModal();
  document.body.classList.add('dialog-open');
  byId('modal-close')?.focus();
}

function openSkill(skillId, trigger) {
  const skill = (state.data.skills || []).find(item => item.id === skillId);
  const dialog = byId('skill-dialog');
  if (!skill || !dialog) return;
  state.activeSkillTrigger = trigger;
  const icon = byId('skill-modal-icon');
  if (icon) icon.src = safeImage(skill.iconUrl, 'assets/icons/code.svg');
  text('skill-modal-title', skill.title || skill.name);
  text('skill-modal-status', skill.status);
  const certificate = byId('skill-modal-certificate');
  if (certificate) {
    const certificateUrl = safeImage(skill.certificateUrl, '');
    certificate.hidden = !certificateUrl;
    certificate.src = certificateUrl || 'assets/certificates/azure-fundamentals.png';
    certificate.alt = certificateUrl ? `Certificado: ${skill.title || skill.name}` : '';
  }
  text('skill-modal-description', skill.description);
  const list = byId('skill-modal-details');
  if (list) {
    list.replaceChildren(...(Array.isArray(skill.details) ? skill.details : []).map(value => {
      const item = document.createElement('li');
      item.textContent = String(value);
      return item;
    }));
  }
  dialog.showModal();
  document.body.classList.add('dialog-open');
  byId('skill-modal-close')?.focus();
}

let revealObserver;
function refreshRevealElements() {
  const elements = [...document.querySelectorAll('.reveal')];
  elements.forEach((element, index) => {
    if (!element.style.getPropertyValue('--delay')) element.style.setProperty('--delay', `${Math.min(index * 0.035, 0.32)}s`);
  });
  if (reducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach(element => element.classList.add('visible'));
    return;
  }
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      revealObserver?.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  elements.forEach(element => revealObserver.observe(element));
}

function typeHeroText() {
  if (state.typingStarted) return;
  state.typingStarted = true;
  const introElement = byId('typed-hero');
  const nameElement = byId('typed-name');
  if (!introElement || !nameElement) return;
  const intro = introElement.dataset.text || '';
  const name = nameElement.dataset.text || '';
  if (reducedMotion) {
    introElement.textContent = intro;
    nameElement.textContent = name;
    nameElement.classList.add('typing-complete');
    return;
  }
  let index = 0;
  introElement.textContent = '';
  nameElement.textContent = '';
  const tick = () => {
    introElement.textContent = intro.slice(0, index);
    index += 1;
    if (index <= intro.length) {
      window.setTimeout(tick, 60);
      return;
    }
    window.setTimeout(() => {
      nameElement.textContent = name;
      nameElement.classList.add('typing-complete');
    }, 110);
  };
  window.setTimeout(tick, 280);
}

function initNavigation() {
  const header = document.querySelector('.site-header');
  const menuToggle = byId('menu-toggle');
  const nav = byId('site-nav');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const closeMenu = () => {
    nav?.classList.remove('open');
    menuToggle?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', state.data.settings?.ui?.menuOpenLabel || 'Abrir menu');
  };
  menuToggle?.addEventListener('click', () => {
    const open = !nav?.classList.contains('open');
    nav?.classList.toggle('open', open);
    menuToggle.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open
      ? (state.data.settings?.ui?.menuCloseLabel || 'Fechar menu')
      : (state.data.settings?.ui?.menuOpenLabel || 'Abrir menu'));
  });
  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 20);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-22% 0px -62% 0px' });
    sections.forEach(section => observer.observe(section));
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.getAttribute('href').length > 1) {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        event.preventDefault();
        closeMenu();
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        if (history.pushState) history.pushState(null, '', link.getAttribute('href'));
      }
      return;
    }
    if (nav && menuToggle && !nav.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
}

function initHeroAnimation() {
  const heroItems = [...document.querySelectorAll('.hero-item')];
  const hero = byId('inicio');
  if (reducedMotion || !hero || !('IntersectionObserver' in window)) {
    heroItems.forEach(item => item.classList.add('visible'));
    return;
  }
  heroItems.forEach((item, index) => item.style.setProperty('--hero-delay', `${0.18 + index * 0.14}s`));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      heroItems.forEach(item => item.classList.add('visible'));
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18 });
  observer.observe(hero);
}

function initContentInteractions() {
  byId('skills-grid')?.addEventListener('click', event => {
    const skillButton = event.target.closest('[data-skill-id]');
    if (skillButton) return openSkill(skillButton.dataset.skillId, skillButton);
    const moreButton = event.target.closest('[data-folder-more]');
    if (moreButton) {
      const id = moreButton.dataset.folderMore;
      if (state.expandedFolders.has(id)) state.expandedFolders.delete(id);
      else state.expandedFolders.add(id);
      renderFolders();
      document.querySelector(`[data-folder-more="${CSS.escape(id)}"]`)?.focus();
      return;
    }
    const folderButton = event.target.closest('[data-folder-toggle]');
    if (folderButton) {
      const id = folderButton.dataset.folderToggle;
      if (state.openFolders.has(id)) {
        const folder = folderButton.closest('.skill-folder');
        const paper = folder?.querySelector('.folder-paper');
        folderButton.disabled = true;
        folderButton.setAttribute('aria-expanded', 'false');
        paper?.setAttribute('aria-hidden', 'true');
        if (paper) paper.inert = true;
        folder?.classList.add('is-closing');
        window.setTimeout(() => {
          state.openFolders.delete(id);
          renderFolders();
          document.querySelector(`[data-folder-toggle="${CSS.escape(id)}"]`)?.focus();
        }, reducedMotion ? 0 : 620);
      } else {
        state.openFolders.add(id);
        renderFolders();
        document.querySelector(`[data-folder-toggle="${CSS.escape(id)}"]`)?.focus();
      }
    }
  });
  byId('projects-grid')?.addEventListener('click', event => {
    const button = event.target.closest('[data-project-id]');
    if (button) openProject(button.dataset.projectId);
  });
  byId('experience-toggle')?.addEventListener('click', event => {
    state.expandedExperiences = !state.expandedExperiences;
    renderExperiences();
    event.currentTarget.focus();
  });

  const projectDialog = byId('project-dialog');
  const skillDialog = byId('skill-dialog');
  byId('modal-close')?.addEventListener('click', () => projectDialog?.close());
  byId('skill-modal-close')?.addEventListener('click', () => skillDialog?.close());
  [projectDialog, skillDialog].forEach(dialog => {
    dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  });
  skillDialog?.addEventListener('close', () => {
    const trigger = state.activeSkillTrigger;
    state.activeSkillTrigger = null;
    if (trigger?.isConnected) trigger.focus();
  });
}

function initBunnyInteraction() {
  const button = byId('bunny-interaction');
  if (!button) return;
  let resetTimer = 0;
  button.addEventListener('click', () => {
    window.clearTimeout(resetTimer);
    button.classList.remove('is-reacting');
    void button.offsetWidth;
    button.classList.add('is-reacting');
    button.setAttribute('aria-label', 'Coelhinho reagindo');
    resetTimer = window.setTimeout(() => {
      button.classList.remove('is-reacting');
      button.setAttribute('aria-label', 'Interagir com o coelhinho');
    }, reducedMotion ? 450 : 1500);
  });
}

function initContactForm() {
  const form = byId('contact-form');
  const status = byId('contact-status');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const settings = state.data.settings || {};
    const destination = String(settings.contact?.destinationEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
      status.textContent = settings.ui?.contactMissingEmail || 'O e-mail de destino ainda não foi configurado.';
      return;
    }
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const subject = encodeURIComponent(`Contato pelo portfólio — ${name}`);
    const body = encodeURIComponent(`Nome: ${name}\nE-mail: ${email}\n\n${message}`);
    status.textContent = settings.ui?.contactOpeningEmail || 'Abrindo seu aplicativo de e-mail para concluir o envio.';
    window.location.href = `mailto:${destination}?subject=${subject}&body=${body}`;
  });
}

async function boot() {
  renderPortfolio(state.data, { resetFolderState: true });
  initNavigation();
  initHeroAnimation();
  initContentInteractions();
  initBunnyInteraction();
  initContactForm();
  try {
    const { loadPortfolio } = await import('./data-service.js');
    const remoteData = await loadPortfolio();
    if (remoteData) renderPortfolio(remoteData, { resetFolderState: true });
  } catch (error) {
    console.warn('Portfólio: usando o conteúdo local porque os dados remotos não puderam ser carregados.', error);
  }
  typeHeroText();
}

boot();
