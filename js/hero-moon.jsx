import React from 'react';
import { createRoot } from 'react-dom/client';

import HalftoneReveal from './components/HalftoneReveal.jsx';
import './hero-moon.css';

const roots = new WeakMap();

function HeroMoon() {
  return (
    <div className="hero-moon" aria-hidden="true">
      <HalftoneReveal
        src="/assets/lua-rosa.png"
        fit="contain"
        mode="duotone"
        shape="dot"
        cellSize={7}
        angle={38}
        dotScale={0.94}
        inkColor="#f9cee1"
        accentColor="#bc7fa3"
        paperColor="#09080a"
        contrast={1.05}
        brightness={0.02}
        roughness={0.08}
        misregistration={0.08}
        revealRadius={145}
        softness={0.7}
        linger={1.35}
        clickBurst
        intro
      />
    </div>
  );
}

export function renderHeroMoon(container) {
  if (!container) return;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<HeroMoon />);
}
