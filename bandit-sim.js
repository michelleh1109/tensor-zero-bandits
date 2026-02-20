/* ─────────────────────────────────────────────────────────────────
   bandit-sim.js
   Adaptive Experiment Simulator — algorithm, chart, and controls.
   Drives the interactive in Section 2 of the blog.
───────────────────────────────────────────────────────────────── */

// ── Config ───────────────────────────────────────────────────────
const VARIANT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444'];
const VARIANT_NAMES  = ['Variant A', 'Variant B', 'Variant C', 'Variant D'];
const DEFAULT_RATES  = [0.55, 0.45, 0.72, 0.48];
const DELTA          = 0.05;   // error tolerance (fixed for the sim)
const MAX_STEPS      = 5000;   // hard cap on inferences
const CHART_SAMPLE   = 15;     // record allocation every N steps

// ── State ─────────────────────────────────────────────────────────
let simMode      = 'adaptive'; // 'adaptive' | 'uniform'
let simRunning   = false;
let simTimer     = null;
let stepsPerTick = 15;

let arms         = [];
let allocHistory = [];   // [{ t, allocs: [...] }]
let simDone      = false;
let simWinner    = null;


// ── Arm class ─────────────────────────────────────────────────────
class Arm {
  constructor(idx) {
    this.idx       = idx;
    this.name      = VARIANT_NAMES[idx];
    this.color     = VARIANT_COLORS[idx];
    this.trueRate  = DEFAULT_RATES[idx];
    this.pulls     = 0;
    this.successes = 0;
  }
  get mean() { return this.pulls === 0 ? 0.5 : this.successes / this.pulls; }
  pull() {
    this.pulls++;
    if (Math.random() < this.trueRate) { this.successes++; return true; }
    return false;
  }
  reset() { this.pulls = 0; this.successes = 0; }
}

function totalPulls() { return arms.reduce((s, a) => s + a.pulls, 0); }
function bestArmIdx() { return arms.reduce((b, a, i) => a.mean > arms[b].mean ? i : b, 0); }


// ── Algorithm: math ───────────────────────────────────────────────

// KL divergence between two Bernoulli distributions
function klBern(p, q) {
  p = Math.max(1e-9, Math.min(1 - 1e-9, p));
  q = Math.max(1e-9, Math.min(1 - 1e-9, q));
  return p * Math.log(p / q) + (1 - p) * Math.log((1 - p) / (1 - q));
}

// Generalized Likelihood Ratio Test statistic for arm_i vs arm_j
function glrtStat(arm_i, arm_j) {
  if (arm_i.pulls < 1 || arm_j.pulls < 1) return 0;
  if (arm_i.mean <= arm_j.mean) return 0;
  return arm_i.pulls * klBern(arm_i.mean, arm_j.mean) +
         arm_j.pulls * klBern(arm_j.mean, arm_i.mean);
}

// Anytime-valid stopping threshold — safe to evaluate at any time t
function stoppingThreshold(t) {
  return Math.log((Math.log(t + Math.E) + 1) / DELTA);
}


// ── Algorithm: allocation (Track-and-Stop) ────────────────────────

function computeAdaptiveAlloc() {
  // Round-robin until each arm has enough data to estimate gaps
  const minP = Math.min(...arms.map(a => a.pulls));
  if (minP < 6) return arms.map(() => 1 / arms.length);

  const best     = bestArmIdx();
  const bestMean = arms[best].mean;

  // Weight each non-best arm by 1/gap² — closer competitors get more traffic
  let w = arms.map((arm, i) => {
    if (i === best) return null;
    const gap = Math.max(bestMean - arm.mean, 0.005);
    return 1 / (gap * gap);
  });

  // Best arm receives total weight equal to all others combined
  const sumOthers = w.reduce((s, v, i) => i === best ? s : s + v, 0);
  w[best] = Math.max(sumOthers, 0.01);

  const total = w.reduce((s, v) => s + v, 0);
  return w.map(v => v / total);
}

function selectArm(alloc) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < alloc.length; i++) {
    cum += alloc[i];
    if (r <= cum) return i;
  }
  return alloc.length - 1; // float rounding fallback
}


// ── Algorithm: stopping criterion ────────────────────────────────

function shouldStop() {
  const t    = totalPulls();
  const minP = Math.min(...arms.map(a => a.pulls));
  if (minP < 12) return false; // need minimum data per arm

  const best   = bestArmIdx();
  const thresh = stoppingThreshold(t);

  for (let i = 0; i < arms.length; i++) {
    if (i === best) continue;
    if (glrtStat(arms[best], arms[i]) < thresh) return false;
  }
  return true;
}


// ── Simulation loop ───────────────────────────────────────────────

function simStep() {
  const alloc = simMode === 'adaptive'
    ? computeAdaptiveAlloc()
    : arms.map(() => 1 / arms.length);

  const idx = selectArm(alloc);
  arms[idx].pull();

  const t = totalPulls();
  if (t % CHART_SAMPLE === 0) {
    allocHistory.push({ t, allocs: alloc.slice() });
  }

  if (shouldStop()) {
    simDone   = true;
    simWinner = bestArmIdx();
  }
}

function runBatch() {
  for (let i = 0; i < stepsPerTick; i++) {
    if (simDone || totalPulls() >= MAX_STEPS) break;
    simStep();
  }
  renderSim();
  if (simDone || totalPulls() >= MAX_STEPS) {
    stopSim();
    showWinner();
  }
}


// ── Chart ─────────────────────────────────────────────────────────

let simChart = null;

function initSimChart() {
  const ctx = document.getElementById('sim-chart').getContext('2d');
  if (simChart) simChart.destroy();

  simChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   [],
      datasets: arms.map(arm => ({
        label:           arm.name,
        data:            [],
        borderColor:     arm.color,
        backgroundColor: arm.color + '18',
        borderWidth:     2,
        pointRadius:     0,
        tension:         0.35,
        fill:            true,
      }))
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 0 },
      interaction:         { mode: 'index', intersect: false },
      scales: {
        x: {
          title: { display: true, text: 'Inferences', color: '#8C959F', font: { size: 11 } },
          ticks: { color: '#8C959F', font: { size: 10 }, maxTicksLimit: 8 },
          grid:  { color: '#EAEEF2' },
        },
        y: {
          min: 0, max: 100,
          title: { display: true, text: 'Traffic allocation (%)', color: '#8C959F', font: { size: 11 } },
          ticks: { color: '#8C959F', font: { size: 10 }, callback: v => v + '%' },
          grid:  { color: '#EAEEF2' },
        }
      },
      plugins: {
        legend:  { display: true, position: 'top', labels: { boxWidth: 10, padding: 16, font: { size: 11 }, color: '#57606A' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } }
      }
    }
  });
}

function updateChartData() {
  if (!simChart) return;
  simChart.data.labels = allocHistory.map(d => d.t);
  arms.forEach((arm, i) => {
    simChart.data.datasets[i].data = allocHistory.map(d => +(d.allocs[i] * 100).toFixed(1));
  });
  simChart.update('none');
}


// ── UI rendering ──────────────────────────────────────────────────

function buildVariantRows() {
  const container = document.getElementById('variant-rows');
  container.innerHTML = '';
  arms.forEach((arm, i) => {
    container.innerHTML += `
      <div class="variant-row">
        <div class="variant-name">
          <span class="v-dot" style="background:${arm.color}"></span>
          ${arm.name}
        </div>
        <input type="range" min="5" max="95" value="${Math.round(arm.trueRate * 100)}"
          oninput="setRate(${i}, this.value)" />
        <span class="range-val" id="rate-${i}">${Math.round(arm.trueRate * 100)}%</span>
      </div>`;
  });
}

function buildAllocBars() {
  const container = document.getElementById('alloc-bars');
  container.innerHTML = '';
  arms.forEach((arm, i) => {
    container.innerHTML += `
      <div class="alloc-row">
        <div class="alloc-name">
          <span class="v-dot" style="background:${arm.color}"></span>
          ${arm.name}
        </div>
        <div class="alloc-bar-bg">
          <div class="alloc-bar" id="abar-${i}" style="width:25%;background:${arm.color}"></div>
        </div>
        <span class="alloc-pct" id="apct-${i}">25%</span>
      </div>`;
  });
}

function renderAllocBars() {
  const alloc = simMode === 'adaptive'
    ? computeAdaptiveAlloc()
    : arms.map(() => 1 / arms.length);

  arms.forEach((arm, i) => {
    const pct = Math.round(alloc[i] * 100);
    const bar = document.getElementById(`abar-${i}`);
    const lbl = document.getElementById(`apct-${i}`);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = pct + '%';
  });
}

function renderSim() {
  document.getElementById('stat-total').textContent = totalPulls().toLocaleString();

  const b        = bestArmIdx();
  const leaderEl = document.getElementById('stat-leader');
  leaderEl.textContent = arms[b].name;
  leaderEl.style.color = arms[b].color;

  document.getElementById('stat-status').textContent =
    simDone ? 'Complete' : simRunning ? 'Running…' : 'Paused';

  renderAllocBars();
  updateChartData();
}

function showWinner() {
  const bar  = document.getElementById('winner-bar');
  const text = document.getElementById('winner-text');
  const w    = simWinner !== null ? simWinner : bestArmIdx();
  bar.classList.add('show');
  text.innerHTML =
    `<strong>${arms[w].name}</strong> identified as winner after ${totalPulls().toLocaleString()} inferences.` +
    (simMode === 'adaptive'
      ? ` Adaptive sampling stopped early — uniform would need ~${Math.round(totalPulls() * 1.42).toLocaleString()}.`
      : '');
}


// ── Controls (called from HTML onclick attributes) ────────────────

function setMode(m) {
  simMode = m;
  document.getElementById('tgl-adaptive').className = 'tgl' + (m === 'adaptive' ? ' on' : '');
  document.getElementById('tgl-uniform').className  = 'tgl' + (m === 'uniform'  ? ' on' : '');
  resetSim();
}

function setSpeed(v) {
  stepsPerTick = { '1': 5, '3': 15, '10': 50, '50': 200 }[v] || 15;
}

function setRate(i, v) {
  arms[i].trueRate = v / 100;
  document.getElementById(`rate-${i}`).textContent = v + '%';
}

function togglePlay() {
  if (simDone) { resetSim(); return; }
  simRunning ? pauseSim() : startSim();
}

function startSim() {
  simRunning = true;
  document.getElementById('btn-play').innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/></svg> Pause';
  simTimer = setInterval(runBatch, 80);
}

function pauseSim() {
  simRunning = false;
  clearInterval(simTimer);
  document.getElementById('btn-play').innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg> Play';
  renderSim();
}

function stopSim() {
  simRunning = false;
  clearInterval(simTimer);
  document.getElementById('btn-play').innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg> Play';
  renderSim();
}

function resetSim() {
  stopSim();
  arms.forEach(a => a.reset());
  allocHistory = [];
  simDone      = false;
  simWinner    = null;

  document.getElementById('stat-total').textContent  = '0';
  document.getElementById('stat-leader').textContent = '—';
  document.getElementById('stat-status').textContent = 'Waiting';
  document.getElementById('winner-bar').classList.remove('show');
  document.getElementById('btn-play').innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg> Play';

  arms.forEach((_, i) => {
    const bar = document.getElementById(`abar-${i}`);
    const lbl = document.getElementById(`apct-${i}`);
    if (bar) bar.style.width = '25%';
    if (lbl) lbl.textContent = '25%';
  });

  initSimChart();
}


// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  arms = DEFAULT_RATES.map((_, i) => new Arm(i));
  buildVariantRows();
  buildAllocBars();
  initSimChart();
});
