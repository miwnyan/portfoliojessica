import React from 'react';
import Strands from './Strands.jsx';

const NYAN_ORB_COLORS = ['#efadd0', '#f9cee1', '#ffffff', '#efadd0', '#cf9fff', '#9d6ec5', '#6e497e'];

export default function NyanOrb({ className = '', active = false, interactive = false }) {
  return <span className={`${className} ${active ? 'is-active' : ''}`.trim()} aria-hidden="true">
    <Strands
      colors={NYAN_ORB_COLORS}
      count={3}
      energy={active ? 1 : 0.62}
      listening={active}
      speed={active ? 1.65 : 0.82}
      amplitude={active ? 1.16 : 1}
      spread={active ? 1.15 : 1}
      glow={active ? 1.3 : 1.15}
      saturation={0.9}
      interactive={interactive}
      clickPulse={interactive}
      maxDevicePixelRatio={1.5}
    />
  </span>;
}
