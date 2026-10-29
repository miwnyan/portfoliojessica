import React from 'react';
import { createRoot } from 'react-dom/client';

import TextType from './components/TextType.jsx';

const roots = new WeakMap();
const PHRASE_PAUSES = Object.freeze([7000, 5000, 5000, 5000]);

function HeroTyping({ hero }) {
  const name = String(hero?.name || 'Jéssica').trim();
  const intro = String(hero?.intro || 'Olá, eu sou a ');
  const phrases = [
    `${intro}${name}`.trim(),
    'Desenvolvo sistemas',
    'Crio automações',
    'Protejo redes e dados'
  ];

  return (
    <TextType
      key={phrases.join('|')}
      as="h1"
      className="hero-title"
      text={phrases}
      highlightWords={[name]}
      variableSpeed={{ min: 48, max: 82 }}
      initialDelay={260}
      pauseDuration={PHRASE_PAUSES}
      deletingSpeed={28}
      deleteMode="backspace"
      typeEffect="fade"
      cursorStyle="bar"
      cursorColor="var(--accent-light)"
      cursorBlinkDuration={0.55}
      cursorGlide
      showCursor
      startOnVisible
    />
  );
}

export function renderHeroTyping(container, hero) {
  if (!container) return;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<HeroTyping hero={hero} />);
}
