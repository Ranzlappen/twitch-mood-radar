// Approval/dissent scoring
import { state } from '../state.js';
import { WINDOW_MS } from '../config.js';
import { expWeight } from './ewma.js';

export function computeApproval(now) {
  const cutoff = now - WINDOW_MS;
  while (state.approvalStore.length && state.approvalStore[0].ts < cutoff) state.approvalStore.shift();
  if (state.approvalStore.length === 0) return null;
  let sumPos = 0, sumNeg = 0, sumW = 0;
  for (const { ts, vote } of state.approvalStore) {
    const w = expWeight(now - ts);
    if (vote > 0) sumPos += vote * w; else sumNeg += Math.abs(vote) * w;
    sumW += w;
  }
  if (sumW === 0) return null;
  const total = sumPos + sumNeg || 0.001;
  return 50 + (sumPos - sumNeg) / total * 50;
}

export function approvalVerdict(score) {
  if (score > 88) return ['OVERWHELMING APPROVAL','#00ffe5'];
  if (score > 74) return ['STRONG APPROVAL','#00ddcc'];
  if (score > 62) return ['LEANING APPROVAL','#00bb99'];
  if (score > 54) return ['MILD APPROVAL','#44aa88'];
  if (score > 46) return ['MIXED - DIVIDED CHAT','#8888aa'];
  if (score > 38) return ['MILD DISSENT','#cc7755'];
  if (score > 26) return ['LEANING DISSENT','#ee5533'];
  if (score > 14) return ['STRONG DISSENT','#ff3311'];
  return ['OVERWHELMING REJECTION','#ff4800'];
}
