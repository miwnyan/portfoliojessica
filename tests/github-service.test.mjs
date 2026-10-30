import assert from 'node:assert/strict';
import { fetchPublicRepository } from '../js/github-service.js';

let calls = 0;
const result = await fetchPublicRepository('miwnyan/exemplo', {
  includeImages: true,
  fetchImpl: async url => {
    calls += 1;
    if (String(url).includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { tree: [
            { type: 'blob', path: 'assets/logo.png', size: 2000 },
            { type: 'blob', path: 'public/screenshots/project-preview.webp', size: 90000 },
            { type: 'blob', path: 'README.md', size: 200 }
          ] };
        }
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return {
          id: 123,
          private: false,
          owner: { login: 'miwnyan' },
          name: 'exemplo',
          description: 'Projeto de exemplo',
          language: 'JavaScript',
          topics: ['react'],
          default_branch: 'main',
          html_url: 'https://github.com/miwnyan/exemplo',
          homepage: 'https://example.com',
          archived: false,
          fork: false,
          stargazers_count: 2,
          forks_count: 1,
          updated_at: '2026-10-30T00:00:00Z'
        };
      }
    };
  }
});

assert.equal(calls, 2);
assert.match(result.coverUrl, /raw\.githubusercontent\.com\/miwnyan\/exemplo\/main\/public\/screenshots\/project-preview\.webp/);
assert.equal(result.repositoryImages[0].path, 'public/screenshots/project-preview.webp');
assert.deepEqual(result.technologies, ['JavaScript', 'react']);

console.log('GitHub service tests passed');
