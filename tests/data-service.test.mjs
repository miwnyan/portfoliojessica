import assert from 'node:assert/strict';

import { normalizePortfolio } from '../js/data-service.js';
import { DEFAULT_PORTFOLIO, ICON_CATALOG, PRESET_MEDIA_LIBRARY } from '../js/default-data.js';

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

const pinnedPreviews = normalizePortfolio({
  projects: [
    { id: 'prumo', name: 'Prumo', coverUrl: 'https://opengraph.githubassets.com/prumo' },
    { id: 'lastro', name: 'Lastro', coverUrl: 'https://opengraph.githubassets.com/lastro' },
    { id: 'cirro', name: 'Cirro', coverUrl: 'https://opengraph.githubassets.com/cirro' },
    { id: 'nexo', name: 'Nexo', coverUrl: 'https://opengraph.githubassets.com/nexo' },
    { id: 'cafeteria', name: 'SistemaCafeteria' },
    { id: 'sysdaisy', name: 'SysDaisyOptimizer' }
  ]
});
const pinnedPreviewById = new Map(pinnedPreviews.projects.map(project => [project.id, project.coverUrl]));
assert.equal(pinnedPreviewById.get('prumo'), '/assets/projects/prumo-preview.png');
assert.equal(pinnedPreviewById.get('lastro'), '/assets/projects/lastro-preview.png');
assert.equal(pinnedPreviewById.get('cirro'), '/assets/projects/cirro-preview.png');
assert.equal(pinnedPreviewById.get('nexo'), '/assets/projects/nexo-preview.png');

const cisco = DEFAULT_PORTFOLIO.skills.find(skill => skill.id === 'cisco-ccst');
assert.equal(cisco.certificateUrl, '/assets/certificates/cisco-ccst-cybersecurity.png');
const migratedCisco = normalizePortfolio({
  skills: [{ id: 'cisco-ccst', folderId: 'cloud-security', name: 'Cisco CCST' }]
}).skills.find(skill => skill.id === 'cisco-ccst');
assert.equal(migratedCisco.certificateUrl, '/assets/certificates/cisco-ccst-cybersecurity.png');
for (const iconId of ['vitejs', 'wireshark', 'router', 'gitlab', 'canva', 'scikitlearn', 'grafana']) {
  assert.ok(ICON_CATALOG.some(icon => icon.id === iconId), `Ícone ausente: ${iconId}`);
}
assert.ok(PRESET_MEDIA_LIBRARY.length >= 9);
assert.ok(PRESET_MEDIA_LIBRARY.filter(item => item.kind === 'project-cover').length >= 6);

console.log('Data service tests passed');
