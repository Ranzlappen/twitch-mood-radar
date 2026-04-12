/**
 * Bubble Physics Engine — spring gravity consensus bubbles.
 */
import { state } from '../state.js';
import { MOOD_COLORS } from '../config.js';
import { hexAlpha } from '../utils/color.js';
import { sanitize } from '../utils/dom.js';

/* ── module-level variables ──────────────────────────── */

let bubCanvas, bubCtx;
let bubbles = [];
let hoveredBubble = null;
let tip;

/* ── public API ──────────────────────────────────────── */

export function resizeBubbleCanvas() {
  if (!bubCanvas) return;
  const parent = bubCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  // Sync canvas display size to parent container boundaries
  if (parent) {
    const pw = parent.clientWidth;
    const ph = parent.clientHeight || bubCanvas.offsetHeight;
    if (pw > 0) bubCanvas.style.width = pw + 'px';
    if (ph > 0) bubCanvas.style.height = ph + 'px';
  }
  bubCanvas.width = bubCanvas.offsetWidth * dpr;
  bubCanvas.height = bubCanvas.offsetHeight * dpr;
  bubCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Re-clamp existing bubbles to new bounds
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  for (const b of bubbles) {
    b.x = Math.max(b.r + 4, Math.min(W - b.r - 4, b.x));
    b.y = Math.max(b.r + 4, Math.min(H - b.r - 4, b.y));
  }
}

export function initBubbles() {
  bubCanvas = document.getElementById('bubbleCanvas');
  bubCtx = bubCanvas.getContext('2d');
  tip = document.getElementById('bubbleTip');
  resizeBubbleCanvas();
  window.addEventListener('resize', resizeBubbleCanvas);
  bubCanvas.addEventListener('mousemove', onBubbleHover);
  bubCanvas.addEventListener('mouseleave', () => { hoveredBubble = null; tip.style.opacity = '0'; });
  bubAnimLoop();
}

export function updateBubbles(kwList) {
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  if (!W || !H) return;
  const top = kwList.slice(0, state.drawerOptions.bubbleCount || 22);
  const maxScore = top[0]?.score || 1;
  const maxR = Math.min(W, H) * 0.42 * state.bubbleScale; // scale by bubble scale slider
  const existing = new Map(bubbles.map(b => [b.label, b]));
  const next = [];
  for (const { label, score, mood } of top) {
    const targetR = Math.min((16 + (score / maxScore) * 55) * state.bubbleScale, maxR);
    if (existing.has(label)) {
      const b = existing.get(label);
      b.targetR = targetR; b.mood = mood; b.score = score;
      next.push(b);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const sr = Math.min(W, H) * 0.15;
      next.push({ label, mood, score,
        x: W / 2 + Math.cos(angle) * sr, y: H / 2 + Math.sin(angle) * sr,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: targetR * 0.3, targetR });
    }
  }
  bubbles = next;
}

/* ── internal helpers ────────────────────────────────── */

function onBubbleHover(e) {
  const rect = bubCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  hoveredBubble = null; tip.style.opacity = '0';
  for (const b of bubbles) {
    const dx = mx - b.x, dy = my - b.y;
    if (dx * dx + dy * dy < b.r * b.r) {
      hoveredBubble = b;
      tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 14) + 'px';
      tip.style.opacity = '1';
      tip.textContent = sanitize(b.label) + ' - ' + b.mood;
      break;
    }
  }
}

function bubAnimLoop() {
  requestAnimationFrame(bubAnimLoop);
  const W = bubCanvas.offsetWidth, H = bubCanvas.offsetHeight;
  if (!W || !H) return;
  bubCtx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const SPRING_K = 0.004 * (state.drawerOptions.bubbleSpeed || 1);

  for (const b of bubbles) {
    b.r += (b.targetR - b.r) * 0.05;
    const dx = cx - b.x, dy = cy - b.y;
    b.vx += dx * SPRING_K; b.vy += dy * SPRING_K;
    b.vx += (Math.random() - 0.5) * 0.015; b.vy += (Math.random() - 0.5) * 0.015;
    b.vx *= 0.90; b.vy *= 0.90;
    const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (spd > 1.5) { b.vx = b.vx / spd * 1.5; b.vy = b.vy / spd * 1.5; }
    b.x += b.vx; b.y += b.vy;
    // Clamp radius to fit within canvas
    const effR = Math.min(b.r, Math.min(W, H) * 0.48 * state.bubbleScale);
    b.r = effR;
    const pad = 4;
    if (b.x - b.r < pad)    { b.x = b.r + pad;     b.vx = Math.abs(b.vx) * 0.3; }
    if (b.x + b.r > W - pad) { b.x = W - b.r - pad; b.vx = -Math.abs(b.vx) * 0.3; }
    if (b.y - b.r < pad)    { b.y = b.r + pad;     b.vy = Math.abs(b.vy) * 0.3; }
    if (b.y + b.r > H - pad) { b.y = H - b.r - pad; b.vy = -Math.abs(b.vy) * 0.3; }
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minD = a.r + b.r + 2;
        if (distSq < minD * minD) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = (minD - dist) * 0.5;
          const nx = dx / dist, ny = dy / dist;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (relV < 0) {
            a.vx -= nx * relV * 0.25; a.vy -= ny * relV * 0.25;
            b.vx += nx * relV * 0.25; b.vy += ny * relV * 0.25;
          }
        }
      }
    }
  }

  for (const b of bubbles) {
    const col = MOOD_COLORS[b.mood] || '#2e3d5e';
    const isHov = b === hoveredBubble;
    bubCtx.beginPath();
    bubCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    bubCtx.fillStyle = hexAlpha(col, isHov ? 0.52 : (state.drawerOptions.bubbleOpacity || 0.28));
    bubCtx.fill();
    if (isHov) { bubCtx.shadowColor = col; bubCtx.shadowBlur = 16; }
    bubCtx.strokeStyle = hexAlpha(col, isHov ? 1.0 : 0.65);
    bubCtx.lineWidth = isHov ? 2.5 : 1.5;
    bubCtx.stroke();
    bubCtx.shadowBlur = 0;
    if (b.r < 12) continue;
    // Apply labelScale; base range 9–20px
    const fontSize = Math.max(9, Math.min(b.r * 0.42 * state.labelScale, 20 * state.labelScale));
    bubCtx.font = `bold ${Math.round(fontSize)}px 'Share Tech Mono', monospace`;
    bubCtx.textAlign = 'center'; bubCtx.textBaseline = 'middle';
    bubCtx.fillStyle = isHov ? '#fff' : 'rgba(255,255,255,0.88)';
    const txt = b.label.length > 11 ? b.label.slice(0, 10) + '.' : b.label;
    bubCtx.fillText(txt, b.x, b.y, b.r * 1.75);
  }
}
