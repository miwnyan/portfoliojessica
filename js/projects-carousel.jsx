import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import CircularCarousel from './components/CircularCarousel.jsx';

const roots = new WeakMap();

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function ProjectCarousel({ projects, onOpenProject }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(() => projects.map(project => ({
    src: project.coverUrl,
    alt: project.coverAlt || `Preview do projeto ${project.name}`,
    title: project.name,
    subtitle: project.technologies?.slice(0, 2).join(' · ') || 'Projeto',
    project
  })), [projects]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(0, projects.length - 1)));
  }, [projects.length]);

  if (!projects.length) {
    return <p className="projects-carousel__empty">Nenhum projeto publicado no momento.</p>;
  }

  const activeProject = projects[activeIndex] || projects[0];
  const repository = activeProject.repositoryUrl || activeProject.repository || activeProject.repositorio;
  const homepage = activeProject.homepageUrl;

  return (
    <div className="projects-carousel">
      <div className="projects-carousel__stage">
        <CircularCarousel
          items={items}
          preset="cylinder"
          intro="rise"
          cardWidth={360}
          aspectRatio={1.64}
          gap={28}
          speed={8}
          momentum={0.72}
          parallax={0.22}
          stretch={0.28}
          depthFade={0.7}
          fadeColor="#09080a"
          innerShade={0.7}
          cornerRadius={13}
          captions={false}
          pauseOnHover
          focusOnClick
          onChange={setActiveIndex}
          onItemClick={item => onOpenProject(item.project.id)}
        />
      </div>

      <div className="projects-carousel__meta" aria-live="polite" aria-atomic="true">
        <div className="projects-carousel__counter" aria-label={`Projeto ${activeIndex + 1} de ${projects.length}`}>
          <span>{String(activeIndex + 1).padStart(2, '0')}</span>
          <span aria-hidden="true">/</span>
          <span>{String(projects.length).padStart(2, '0')}</span>
        </div>
        <h3>{activeProject.name}</h3>
        <p>{activeProject.summary}</p>
        <div className="project-tags" aria-label="Tecnologias">
          {(activeProject.technologies || []).map(technology => <span key={technology}>{technology}</span>)}
        </div>
        <div className="projects-carousel__actions">
          <button type="button" className="btn btn-primary btn-small" onClick={() => onOpenProject(activeProject.id)}>
            Ver detalhes
          </button>
          {homepage ? (
            <a className="projects-carousel__link" href={homepage} target="_blank" rel="noopener noreferrer">
              Abrir projeto <ArrowIcon />
            </a>
          ) : null}
          {repository ? (
            <a className="projects-carousel__link projects-carousel__link--muted" href={repository} target="_blank" rel="noopener noreferrer">
              GitHub <ArrowIcon />
            </a>
          ) : null}
        </div>
      </div>

      <p className="projects-carousel__hint">Arraste para explorar · use as setas do teclado para navegar</p>
    </div>
  );
}

export function renderProjectsCarousel(container, projects, onOpenProject) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<ProjectCarousel projects={projects} onOpenProject={onOpenProject} />);
}
