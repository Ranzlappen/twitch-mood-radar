/**
 * Approval Meter — updates the approval gauge, verdict, and mini bars.
 */
import { state } from '../state.js';
import { lerpColor } from '../utils/color.js';
import { computeApproval, approvalVerdict } from '../analysis/approval.js';

/**
 * Update the approval meter UI with the latest computed values.
 * @param {number} now — current timestamp (Date.now())
 */
export function updateApprovalMeter(now) {
  const approvalRaw = computeApproval(now);
  if (approvalRaw === null) return;

  state.approvalDisplayVal += (approvalRaw - state.approvalDisplayVal) * 0.18;
  const val = state.approvalDisplayVal;
  const pctV = Math.max(2, Math.min(98, val));

  const thumb = document.getElementById('approvalThumb');
  thumb.style.left = pctV + '%';

  let thumbCol;
  if (val >= 50) { const t = (val - 50) / 50; thumbCol = lerpColor('#8888aa', '#00ffe5', t); }
  else           { const t = (50 - val) / 50; thumbCol = lerpColor('#8888aa', '#ff4800', t); }

  thumb.style.background = '#0d0d1f';
  thumb.style.color = thumbCol;
  thumb.style.borderColor = thumbCol;
  thumb.style.boxShadow = `0 0 22px ${thumbCol}99, 0 0 8px ${thumbCol}55`;

  const signedScore = Math.round(val - 50);
  const scoreEl = document.getElementById('approvalScore');
  scoreEl.textContent = (signedScore >= 0 ? '+' : '') + signedScore;
  scoreEl.style.color = thumbCol;
  scoreEl.style.textShadow = `0 0 24px ${thumbCol}88`;

  const [vText, vCol] = approvalVerdict(val);
  const verdictEl = document.getElementById('approvalVerdict');
  verdictEl.textContent = vText; verdictEl.style.color = vCol;

  state.approvalHistory.push(val);
  if (state.approvalHistory.length > 40) state.approvalHistory.shift();

  const bars = document.getElementById('approvalMini').children;
  for (let i = 0; i < bars.length; i++) {
    const v = state.approvalHistory[i] ?? 50;
    const h = Math.max(3, Math.abs(v - 50) / 50 * 28);
    let bc;
    if (v >= 50) { const t = (v - 50) / 50; bc = lerpColor('#555577', '#00ffe5', t); }
    else         { const t = (50 - v) / 50; bc = lerpColor('#555577', '#ff4800', t); }
    bars[i].style.height = h + 'px'; bars[i].style.background = bc;
  }
}
