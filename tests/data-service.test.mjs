import assert from 'node:assert/strict';

import { normalizePortfolio } from '../js/data-service.js';

const projects = Array.from({ length: 105 }, (_, index) => ({
  id: `project-${index}`,
  name: `Projeto ${index}`
}));

const contacts = [{
  id: 'email-test',
  type: 'email',
  label: 'E-mail',
  url: 'contato@example.com',
  iconUrl: 'https://example.com/icon.svg'
}];

const normalized = normalizePortfolio({ projects, contacts });

assert.equal(normalized.projects.length, 100);
assert.equal(normalized.contacts[0].url, 'mailto:contato@example.com');
assert.equal(normalized.contacts[0].iconUrl, 'https://example.com/icon.svg');
assert.ok(normalized.settings.ui.projectHomepageLabel);
assert.ok(normalized.settings.ui.projectHomepageTitle);

const migrated = normalizePortfolio({
  schemaVersion: 1,
  projects: [{ id: 'cafeteria', name: 'SistemaCafeteria' }, { id: 'sysdaisy', name: 'SysDaisyOptimizer' }]
});
assert.deepEqual(migrated.projects.map(project => project.id), ['lastro', 'nexo', 'cirro', 'prumo', 'cafeteria', 'sysdaisy']);

const migratedFromFourProjects = normalizePortfolio({
  schemaVersion: 2,
  projects: ['lastro', 'nexo', 'cirro', 'prumo'].map(id => ({ id, name: id }))
});
assert.deepEqual(migratedFromFourProjects.projects.map(project => project.id), ['lastro', 'nexo', 'cirro', 'prumo', 'cafeteria', 'sysdaisy']);

console.log('Data service tests passed');
