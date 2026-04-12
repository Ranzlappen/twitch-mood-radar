// Color utility functions

export function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function lerpColor(hexA, hexB, t) {
  const ra = parseInt(hexA.slice(1,3), 16), ga = parseInt(hexA.slice(3,5), 16), ba = parseInt(hexA.slice(5,7), 16);
  const rb = parseInt(hexB.slice(1,3), 16), gb = parseInt(hexB.slice(3,5), 16), bb = parseInt(hexB.slice(5,7), 16);
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const b = Math.round(ba + (bb - ba) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
