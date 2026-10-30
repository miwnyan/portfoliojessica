const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY_PATTERN = /^[a-z\d_.-]{1,100}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

export class GitHubServiceError extends Error {
  constructor(message, code = 'github/error', details = null) {
    super(message);
    this.name = 'GitHubServiceError';
    this.code = code;
    this.details = details;
  }
}

const cleanText = (value, maxLength = 500) =>
  (typeof value === 'string' ? value : '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const safeHttpUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};

const projectId = (owner, repository) => `${owner}-${repository}`
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'github-project';

export function parseGitHubRepository(input) {
  let owner = '';
  let repository = '';

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    owner = cleanText(input.owner, 39);
    repository = cleanText(input.repo ?? input.repository, 100);
  } else {
    const value = cleanText(input, 500);
    if (!value) {
      throw new GitHubServiceError('Informe a URL ou owner/repositório.', 'github/invalid-input');
    }

    if (/^https?:\/\//i.test(value)) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new GitHubServiceError('A URL do GitHub é inválida.', 'github/invalid-url');
      }
      const hostname = url.hostname.toLowerCase();
      if (hostname !== 'github.com' && hostname !== 'www.github.com') {
        throw new GitHubServiceError('Use uma URL pública de github.com.', 'github/invalid-host');
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length !== 2) {
        throw new GitHubServiceError(
          'Use a URL principal do repositório, como https://github.com/owner/repositorio.',
          'github/invalid-path'
        );
      }
      try {
        [owner, repository] = parts.map(decodeURIComponent);
      } catch {
        throw new GitHubServiceError('A URL do GitHub é inválida.', 'github/invalid-url');
      }
    } else {
      const parts = value.split('/').map(part => part.trim()).filter(Boolean);
      if (parts.length !== 2) {
        throw new GitHubServiceError('Use o formato owner/repositório.', 'github/invalid-input');
      }
      [owner, repository] = parts;
    }
  }

  repository = repository.replace(/\.git$/i, '');
  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repository)) {
    throw new GitHubServiceError('Owner ou nome de repositório inválido.', 'github/invalid-input');
  }

  return Object.freeze({ owner, repository });
}

const responseBody = async response => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

function rateLimitError(response) {
  const resetSeconds = Number(response.headers?.get?.('x-ratelimit-reset'));
  const retryAt = Number.isFinite(resetSeconds) && resetSeconds > 0
    ? new Date(resetSeconds * 1000).toISOString()
    : null;
  return new GitHubServiceError(
    retryAt
      ? `O limite público do GitHub foi atingido. Tente novamente após ${retryAt}.`
      : 'O limite público do GitHub foi atingido. Tente novamente mais tarde.',
    'github/rate-limit',
    { retryAt }
  );
}

const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif)$/i;

function imageScore(path) {
  const normalized = String(path || '').toLowerCase();
  let score = 0;
  if (/(?:^|\/)(?:cover|preview|screenshot|hero|banner|demo)[-_ .]/.test(normalized)) score += 80;
  if (/(?:cover|preview|screenshot|hero|banner|demo)/.test(normalized)) score += 45;
  if (/(?:^|\/)(?:assets|images?|screenshots?|public|static)\//.test(normalized)) score += 25;
  if (/readme|docs?\//.test(normalized)) score += 8;
  if (/icon|logo|favicon|avatar|badge|sprite|thumbnail/.test(normalized)) score -= 35;
  score -= normalized.split('/').length;
  return score;
}

async function fetchRepositoryImages({ owner, repository, branch, fetchImplementation, signal }) {
  if (!branch) return [];
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  try {
    const response = await fetchImplementation(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal
    });
    if (!response.ok) return [];
    const data = await responseBody(response);
    const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/`;
    return (Array.isArray(data?.tree) ? data.tree : [])
      .filter(item => item?.type === 'blob' && IMAGE_EXTENSION.test(String(item.path || '')) && Number(item.size || 0) <= 12 * 1024 * 1024)
      .map(item => ({
        path: cleanText(item.path, 500),
        url: `${rawBase}${String(item.path || '').split('/').map(encodeURIComponent).join('/')}`,
        score: imageScore(item.path)
      }))
      .filter(item => item.path)
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
      .slice(0, 12)
      .map(({ path, url }) => ({ path, url }));
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return [];
  }
}

/**
 * Consulta somente o endpoint público de repositórios. Não lê README, não
 * interpreta HTML e não usa token do navegador.
 */
export async function fetchPublicRepository(input, options = {}) {
  const { owner, repository } = parseGitHubRepository(input);
  const fetchImplementation = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new GitHubServiceError('Este navegador não oferece suporte a fetch.', 'github/fetch-unavailable');
  }

  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  let response;
  try {
    response = await fetchImplementation(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal: options.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new GitHubServiceError('Importação cancelada.', 'github/aborted', null);
    }
    throw new GitHubServiceError('Não foi possível acessar o GitHub.', 'github/network-error', error);
  }

  const data = await responseBody(response);
  const rateLimited = response.status === 429 || (
    response.status === 403 && (
      response.headers?.get?.('x-ratelimit-remaining') === '0' ||
      /(?:rate limit|secondary rate|abuse detection)/i.test(String(data?.message || ''))
    )
  );
  if (rateLimited) throw rateLimitError(response);

  if (response.status === 404) {
    throw new GitHubServiceError(
      'Repositório não encontrado ou não público.',
      'github/not-found-or-private'
    );
  }
  if (!response.ok) {
    throw new GitHubServiceError(
      cleanText(data?.message, 300) || `O GitHub respondeu com o status ${response.status}.`,
      'github/api-error',
      { status: response.status }
    );
  }
  if (!data || data.private === true) {
    throw new GitHubServiceError(
      'Somente repositórios públicos podem ser importados.',
      'github/private-repository'
    );
  }

  const canonicalOwner = cleanText(data.owner?.login, 39) || owner;
  const canonicalRepository = cleanText(data.name, 100) || repository;
  if (!OWNER_PATTERN.test(canonicalOwner) || !REPOSITORY_PATTERN.test(canonicalRepository)) {
    throw new GitHubServiceError('O GitHub retornou dados inesperados.', 'github/invalid-response');
  }

  const language = cleanText(data.language, 100);
  const topics = Array.isArray(data.topics)
    ? data.topics.map(topic => cleanText(topic, 80)).filter(Boolean).slice(0, 30)
    : [];
  const technologies = [...new Set([language, ...topics].filter(Boolean))];
  const repositoryUrl = `https://github.com/${encodeURIComponent(canonicalOwner)}/${encodeURIComponent(canonicalRepository)}`;
  const previewVersion = Number.isSafeInteger(data.id) ? data.id : 1;
  const defaultBranch = cleanText(data.default_branch, 220);
  const repositoryImages = options.includeImages
    ? await fetchRepositoryImages({
      owner: canonicalOwner,
      repository: canonicalRepository,
      branch: defaultBranch,
      fetchImplementation,
      signal: options.signal
    })
    : [];
  const fallbackCover = `https://opengraph.githubassets.com/${previewVersion}/${encodeURIComponent(canonicalOwner)}/${encodeURIComponent(canonicalRepository)}`;

  return {
    id: projectId(canonicalOwner, canonicalRepository),
    order: 0,
    visible: true,
    name: canonicalRepository,
    summary: cleanText(data.description, 800),
    description: '',
    technologies,
    coverUrl: repositoryImages[0]?.url || fallbackCover,
    coverPublicId: '',
    repositoryUrl,
    homepageUrl: safeHttpUrl(data.homepage),
    source: 'github',
    github: {
      owner: canonicalOwner,
      repo: canonicalRepository,
      fullName: `${canonicalOwner}/${canonicalRepository}`,
      defaultBranch,
      language,
      topics,
      archived: data.archived === true,
      fork: data.fork === true,
      stars: Number.isFinite(data.stargazers_count) ? data.stargazers_count : 0,
      forks: Number.isFinite(data.forks_count) ? data.forks_count : 0,
      updatedAt: cleanText(data.updated_at, 40)
    },
    repositoryImages
  };
}

export const importGitHubRepository = fetchPublicRepository;

