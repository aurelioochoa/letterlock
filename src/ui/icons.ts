// Inline SVG icons (design §9: zero asset files). Every button carries one, so the game still
// reads with every string blanked. No <text> inside: a glyph drawn here is a shape, not a word.

const svg = (body: string, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  lantern: svg('<path d="M9 4h6M12 2v2M7 7h10l-1 11H8z" fill="#ffe7a3"/><path d="M12 10c-1.5 1.6-1.5 3.4 0 5 1.5-1.6 1.5-3.4 0-5z" fill="#ff9d2e" stroke="none"/><path d="M6 20h12"/>'),
  setAside: svg('<path d="M4 15a8 8 0 0 1 14-6"/><path d="M19 4v5h-5"/><rect x="7" y="15" width="10" height="6" rx="1.5" fill="#f3c47a"/>'),
  shelf: svg('<path d="M3 20h18M3 12h18M5 12v8M19 12v8"/><circle cx="8.5" cy="9" r="2.5" fill="#ff8f6b"/><rect x="13" y="6" width="5" height="6" rx="1" fill="#8fd0ff"/><path d="M9.5 17h5" />'),
  soundOn: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  key: svg('<circle cx="7" cy="12" r="4" fill="#ffd75e"/><path d="M11 12h10M17 12v3M20 12v2"/>'),
  rubOut: svg('<path d="M9 5h11v14H9l-6-7z" fill="#fff6e2"/><path d="M12 9l5 6M17 9l-5 6"/>'),
  shift: svg('<path d="M12 4l8 8h-4v7H8v-7H4z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  motion: svg('<path d="M3 12c3-5 6 5 9 0s6 5 9 0"/>'),
  alphabet: svg('<path d="M4 19V8l3-3 3 3v11M4 13h6"/><path d="M14 6h6v4h-6zM14 14h6v5h-6z"/>'),
  lowercase: svg('<path d="M3 19L8 5l5 14M5 14h6"/><circle cx="17.5" cy="15.5" r="3.5"/><path d="M21 12v7"/>'),
  star: svg('<path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.6 6.2L12 16.6 6.3 20l1.6-6.2L3 9.7l6.4-.5z" fill="#ffd23f" stroke="#c98a10" stroke-width="1"/>'),
};

/** A size icon: a little chest with one dot per dial (design §3: three chest icons). */
export function chestIcon(dials: number): string {
  const dots = Array.from({ length: dials }, (_, index) => `<circle cx="${7 + (index * 18) / Math.max(1, dials - 1)}" cy="20" r="2.1" fill="#fff4cf" stroke="none"/>`).join('');
  return svg(`<path d="M4 12a8 6 0 0 1 8-6h8a8 6 0 0 1 8 6z" fill="#6d9be8"/><rect x="4" y="12" width="24" height="14" rx="2" fill="#5a86d6"/><rect x="3.5" y="16.5" width="25" height="7" rx="2" fill="#c9952e" stroke="none"/>${dots}`, '0 0 32 30');
}

/** The key ring at the chest's side: the keys still on it (design §3). */
export function keyRing(left: number, total: number): string {
  const keys = Array.from({ length: total }, (_, index) => {
    const angle = -70 + (index * 140) / Math.max(1, total - 1);
    return `<g transform="rotate(${angle} 20 10)" opacity="${index < left ? 1 : 0.15}"><path d="M20 16v15" stroke="#6e4a0c" stroke-width="3"/><path d="M20 26h4.5M20 30h3.5" stroke="#6e4a0c" stroke-width="2.4"/></g>`;
  }).join('');
  return svg(`<circle cx="20" cy="10" r="6" stroke="#5a3c08" stroke-width="2.6"/>${keys}`, '0 0 40 40');
}
