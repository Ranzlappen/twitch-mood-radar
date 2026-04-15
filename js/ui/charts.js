/**
 * Charts — Chart.js initialization, timeline snapshots, and mood legend.
 */
import { state } from '../state.js';
import { MOODS, MOOD_COLORS } from '../config.js';
import { hexAlpha, lerpColor } from '../utils/color.js';
import { computeWeightedMoods } from '../analysis/ewma.js';
import { initBubbles } from './bubbles.js';

/* ── plugins ─────────────────────────────────────────── */

const pieLabelPlugin = {
  id: 'pieLabels',
  afterDraw(chart) {
    if (!state.drawerOptions.pieLabels) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const total = data.reduce((a, b) => a + b, 0) || 1;
    ctx.save();
    meta.data.forEach((arc, i) => {
      const pct = data[i] / total * 100;
      if (pct < 4) return;
      const { x, y } = arc.tooltipPosition();
      // Apply labelScale to font sizes
      const bigFont   = Math.round((pct > 15 ? 13 : 10) * state.labelScale);
      const smallFont = Math.round((pct > 15 ? 11 :  9) * state.labelScale);
      ctx.font = `bold ${bigFont}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
      const offset = Math.round(7 * state.labelScale);
      if (pct > 12) {
        ctx.fillText(labels[i], x, y - offset);
        ctx.font = `${smallFont}px 'Share Tech Mono', monospace`;
        ctx.fillText(pct.toFixed(0) + '%', x, y + offset);
      } else {
        ctx.fillText(pct.toFixed(0) + '%', x, y);
      }
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }
};

// Plugin: draws a dashed horizontal line at y=50 on the approval timeline
const approvalMidlinePlugin = {
  id: 'approvalMidline',
  afterDraw(chart) {
    const yScale = chart.scales.y;
    if (!yScale) return;
    const y = yScale.getPixelForValue(50);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chart.chartArea.left, y);
    ctx.lineTo(chart.chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  }
};

/* ── chart initialization ────────────────────────────── */

export function initCharts() {
  if (state.chartsReady) return;
  state.chartsReady = true;
  Chart.defaults.color = '#4a4a7a';
  Chart.defaults.font.family = 'Share Tech Mono';

  state.pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    plugins: [pieLabelPlugin],
    data: {
      labels: MOODS.map(m => m.toUpperCase()),
      datasets: [{ data: MOODS.map((_, i) => i === MOODS.length - 1 ? 100 : 0), backgroundColor: MOODS.map(m => MOOD_COLORS[m]), borderColor: '#06060f', borderWidth: 3, hoverOffset: 10 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 350, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` }, backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 }
      }
    }
  });

  const moodsForWeb = MOODS.filter(m => m !== 'neutral');
  state.radarChart = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: moodsForWeb.map(m => m.toUpperCase()),
      datasets: [{ label: 'Mood Weight', data: moodsForWeb.map(() => 0), fill: true,
        backgroundColor: 'rgba(0,255,229,.09)', borderColor: '#00ffe5', borderWidth: 2.5,
        pointBackgroundColor: '#00ffe5', pointBorderColor: '#06060f', pointRadius: 4, pointHoverRadius: 7 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutCubic' },
      scales: { r: { min: 0, max: 10, ticks: { display: false }, grid: { color: 'rgba(255,255,255,.055)' }, angleLines: { color: 'rgba(255,255,255,.065)' }, pointLabels: { color: '#7a7aaa', font: { family: 'Share Tech Mono', size: 10, weight: '700' } } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.chart.data.labels[c.dataIndex]}: ${c.parsed.r.toFixed(1)}%` }, backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 } }
    }
  });

  // Approval tick marks
  const tickContainer = document.getElementById('approvalTicks');
  for (let i = 0; i < 9; i++) {
    const t = document.createElement('div');
    t.className = 'approval-tick';
    tickContainer.appendChild(t);
  }

  // Approval mini bars
  const miniContainer = document.getElementById('approvalMini');
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'approval-mini-bar';
    b.style.height = '3px';
    b.style.background = '#333355';
    miniContainer.appendChild(b);
  }

  // Timeline charts — one linear, one log
  const moodsForTL = MOODS.filter(m => m !== 'neutral');

  function makeTimelineDatasets() {
    return moodsForTL.map(m => ({
      label: m.toUpperCase(), data: Array(state.TIMELINE_POINTS).fill(null),
      borderColor: MOOD_COLORS[m], backgroundColor: 'transparent',
      borderWidth: 2, pointRadius: 0, tension: 0.45, fill: false
    }));
  }

  state.timelineLinearChart = new Chart(document.getElementById('timelineLinearChart'), {
    type: 'line',
    data: { labels: Array(state.TIMELINE_POINTS).fill(''), datasets: makeTimelineDatasets() },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#2e2e58', maxRotation: 0, font: { size: 8 } } },
        y: {
          type: 'linear', min: 0, max: 10,
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#2e2e58', font: { size: 8 }, callback: v => v + '%' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 }
      }
    }
  });

  state.timelineLogChart = new Chart(document.getElementById('timelineLogChart'), {
    type: 'line',
    data: { labels: Array(state.TIMELINE_POINTS).fill(''), datasets: makeTimelineDatasets() },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#2e2e58', maxRotation: 0, font: { size: 8 } } },
        y: {
          type: 'logarithmic', min: 0.5, max: 100,
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: {
            color: '#2e2e58', font: { size: 8 },
            callback(v) {
              if (v === 0.5) return '<1%';
              if ([1, 2, 5, 10, 20, 50, 100].includes(v)) return v + '%';
              return null;
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 }
      }
    }
  });

  // Approval timeline — single line showing approval score over time
  state.approvalTimelineChart = new Chart(document.getElementById('approvalTimelineChart'), {
    type: 'line',
    plugins: [approvalMidlinePlugin],
    data: { labels: Array(state.TIMELINE_POINTS).fill(''), datasets: [{
      label: 'APPROVAL', data: Array(state.TIMELINE_POINTS).fill(null),
      borderColor: '#00ffe5', backgroundColor: 'rgba(0,255,229,.08)',
      borderWidth: 2, pointRadius: 0, tension: 0.45, fill: true
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#2e2e58', maxRotation: 0, font: { size: 8 } } },
        y: {
          type: 'linear', min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#2e2e58', font: { size: 8 }, callback: function(v) {
            if (v === 0) return 'DISSENT';
            if (v === 50) return 'NEUTRAL';
            if (v === 100) return 'APPROVAL';
            return v + '%';
          } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 }
      }
    }
  });

  // Throughput timeline — single line showing msg/s over time
  state.throughputTimelineChart = new Chart(document.getElementById('throughputTimelineChart'), {
    type: 'line',
    data: { labels: Array(state.TIMELINE_POINTS).fill(''), datasets: [{
      label: 'THROUGHPUT', data: Array(state.TIMELINE_POINTS).fill(null),
      borderColor: '#00ffe5', backgroundColor: 'rgba(0,255,229,.08)',
      borderWidth: 2, pointRadius: 0, tension: 0.45, fill: true
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#2e2e58', maxRotation: 0, font: { size: 8 } } },
        y: {
          type: 'linear', min: 0,
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#2e2e58', font: { size: 8 }, callback: function(v) { return v + ' msg/s'; } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0d0d1f', borderColor: '#1a1a36', borderWidth: 1 }
      }
    }
  });

  initBubbles();
}

/* ── timeline snapshots ──────────────────────────────── */

export function pushTimelineSnapshot() {
  const pct = computeWeightedMoods(Date.now());
  const label = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });

  // Push to linear timeline
  if (state.timelineLinearChart) {
    state.timelineLinearChart.data.labels.push(label); state.timelineLinearChart.data.labels.shift();
    MOODS.filter(m => m !== 'neutral').forEach((m, i) => {
      const val = pct ? Math.round(pct[m]) : 0;
      state.timelineLinearChart.data.datasets[i].data.push(val);
      state.timelineLinearChart.data.datasets[i].data.shift();
    });
    // Dynamic Y-axis: scale to highest currently displayed value
    let tlMax = 0;
    state.timelineLinearChart.data.datasets.forEach(ds => {
      ds.data.forEach(v => { if (v !== null && v > tlMax) tlMax = v; });
    });
    state.timelineLinearChart.options.scales.y.max = Math.max(10, Math.ceil(tlMax * 1.15));
    state.timelineLinearChart.update('none');
  }

  // Push to log timeline (floor at 0.5 to avoid log(0))
  if (state.timelineLogChart) {
    state.timelineLogChart.data.labels.push(label); state.timelineLogChart.data.labels.shift();
    MOODS.filter(m => m !== 'neutral').forEach((m, i) => {
      let val = pct ? Math.round(pct[m]) : 0;
      if (val < 0.5) val = 0.5;
      state.timelineLogChart.data.datasets[i].data.push(val);
      state.timelineLogChart.data.datasets[i].data.shift();
    });
    state.timelineLogChart.update('none');
  }
}

export function pushApprovalTimelineSnapshot() {
  if (!state.approvalTimelineChart) return;
  const val = Math.round(state.approvalDisplayVal);
  const label = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
  state.approvalTimelineChart.data.labels.push(label);
  state.approvalTimelineChart.data.labels.shift();
  state.approvalTimelineChart.data.datasets[0].data.push(val);
  state.approvalTimelineChart.data.datasets[0].data.shift();
  // Tint line color based on current approval
  let lineCol;
  if (val >= 50) { const t = (val - 50) / 50; lineCol = lerpColor('#8888aa', '#00ffe5', t); }
  else           { const t = (50 - val) / 50; lineCol = lerpColor('#8888aa', '#ff4800', t); }
  state.approvalTimelineChart.data.datasets[0].borderColor = lineCol;
  state.approvalTimelineChart.data.datasets[0].backgroundColor = hexAlpha(lineCol, 0.08);
  state.approvalTimelineChart.update('none');
}

export function pushThroughputTimelineSnapshot() {
  if (!state.throughputTimelineChart) return;
  const now = Date.now();
  const cut3 = now - 3000;
  // Use tsThroughput already maintained in updateVisuals
  const mps = parseFloat((state.tsThroughput.countWhere(t => t >= cut3) / 3).toFixed(1));
  const label = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
  state.throughputTimelineChart.data.labels.push(label);
  state.throughputTimelineChart.data.labels.shift();
  state.throughputTimelineChart.data.datasets[0].data.push(mps);
  state.throughputTimelineChart.data.datasets[0].data.shift();
  // Tint line color based on throughput intensity
  let lineCol;
  if (mps > 30) lineCol = '#ff4800';
  else if (mps > 15) lineCol = '#ffe600';
  else lineCol = '#00ffe5';
  state.throughputTimelineChart.data.datasets[0].borderColor = lineCol;
  state.throughputTimelineChart.data.datasets[0].backgroundColor = hexAlpha(lineCol, 0.08);
  state.throughputTimelineChart.update('none');
}

/* ── timeline settings ───────────────────────────────── */

export function updateTimelinePoints(v) {
  const pts = Math.min(1000, Math.max(50, parseInt(v)));
  document.getElementById('tlPointsVal').textContent = pts;
  try { localStorage.setItem('moodradar_tlpoints_v1', pts); } catch(e) {}
  resizeTimelineData(pts);
  state.TIMELINE_POINTS = pts;
}

export function updateTimelineInterval(v) {
  state.TIMELINE_INTERVAL = Math.min(5000, Math.max(200, parseInt(v)));
  document.getElementById('tlIntervalVal').textContent = state.TIMELINE_INTERVAL + 'ms';
  try { localStorage.setItem('moodradar_tlinterval_v1', state.TIMELINE_INTERVAL); } catch(e) {}
}

export function resizeTimelineData(newPts) {
  const charts = [state.timelineLinearChart, state.timelineLogChart, state.approvalTimelineChart, state.throughputTimelineChart].filter(Boolean);
  for (const chart of charts) {
    const labels = chart.data.labels;
    const datasets = chart.data.datasets;
    if (newPts > labels.length) {
      const pad = newPts - labels.length;
      chart.data.labels = Array(pad).fill('').concat(labels);
      for (const ds of datasets) ds.data = Array(pad).fill(null).concat(ds.data);
    } else if (newPts < labels.length) {
      const trim = labels.length - newPts;
      chart.data.labels = labels.slice(trim);
      for (const ds of datasets) ds.data = ds.data.slice(trim);
    }
    chart.update('none');
  }
}

/* ── mood legend ─────────────────────────────────────── */

export function renderMoodLegend() {
  const el = document.getElementById('moodLegend');
  if (!el) return;
  el.innerHTML = MOODS.map(m => {
    const col = m === 'neutral' ? '#4a6688' : `var(--${m})`;
    return `<div class="legend-item"><span class="legend-dot" style="background:${col}"></span>${m.charAt(0).toUpperCase() + m.slice(1)}</div>`;
  }).join('');
}
