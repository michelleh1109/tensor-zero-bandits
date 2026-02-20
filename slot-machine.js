/* ─────────────────────────────────────────────────────────────────
   slot-machine.js
   Interactive multi-armed bandit slot machine game.
   The player pulls arms to discover each machine's hidden win rate.
   The curves above each machine show a Bayesian posterior (beta
   distribution) updating in real time as data comes in.
───────────────────────────────────────────────────────────────── */

const SM_CONFIG = [
  { label: 'A', color: '#F5BB00', dark: '#7a5c00', trueRate: 0.20 },
  { label: 'B', color: '#FF5200', dark: '#7a2500', trueRate: 0.55 },
  { label: 'C', color: '#5558F0', dark: '#2b2d7a', trueRate: 0.72 },
  { label: 'D', color: '#D4358A', dark: '#7a1f50', trueRate: 0.38 },
];

const SM_SYMBOLS   = ['7', '★', '♦', '♣', '◆', '♥'];
const SM_WIN_COINS = 10;
const SM_PULL_COST = 3;
const SM_START     = 60;

let smMachines   = SM_CONFIG.map((m, i) => ({ ...m, idx: i, pulls: 0, wins: 0, busy: false }));
let smCoins      = SM_START;
let smTotalPulls = 0;


// ── Pull ──────────────────────────────────────────────────────────

function smPull(idx) {
  const m = smMachines[idx];
  if (m.busy) return;
  if (smCoins < SM_PULL_COST) {
    const msg = document.getElementById('sm-msg');
    if (msg) msg.textContent = 'Out of coins — reset to play again.';
    return;
  }

  m.busy = true;
  smCoins -= SM_PULL_COST;
  smTotalPulls++;

  // Arm animation
  const arm = document.getElementById(`sm-arm-${idx}`);
  if (arm) {
    arm.classList.add('sm-arm-down');
    setTimeout(() => arm.classList.remove('sm-arm-down'), 380);
  }

  // Spin reels
  const reels = [0, 1, 2].map(r => document.getElementById(`sm-r-${idx}-${r}`));
  let tick = 0;
  const spinId = setInterval(() => {
    reels.forEach(r => { if (r) r.textContent = SM_SYMBOLS[Math.floor(Math.random() * SM_SYMBOLS.length)]; });
    if (++tick >= 14) {
      clearInterval(spinId);
      smResolve(idx, reels);
    }
  }, 55);

  smRefreshScore();
}

function smResolve(idx, reels) {
  const m   = smMachines[idx];
  const win = Math.random() < m.trueRate;
  m.pulls++;
  if (win) { m.wins++; smCoins += SM_WIN_COINS; }

  // Set reel face
  if (win) {
    reels.forEach(r => { if (r) r.textContent = '7'; });
  } else {
    ['♦', '★', '♣'].forEach((s, i) => { if (reels[i]) reels[i].textContent = s; });
  }

  // Flash
  const flash = document.getElementById(`sm-flash-${idx}`);
  if (flash) {
    flash.textContent = win ? `+${SM_WIN_COINS} 🪙` : 'miss';
    flash.className   = 'sm-flash ' + (win ? 'sm-flash-win' : 'sm-flash-miss');
    setTimeout(() => { flash.className = 'sm-flash'; }, 1100);
  }

  // Per-machine stat
  const statEl = document.getElementById(`sm-stat-${idx}`);
  if (statEl) {
    const pct = Math.round(m.wins / m.pulls * 100);
    statEl.textContent = `${m.pulls} pull${m.pulls !== 1 ? 's' : ''} · ${pct}% wins`;
  }

  m.busy = false;
  smRefreshScore();
  smDrawDist(idx);
}


// ── Score bar ─────────────────────────────────────────────────────

function smRefreshScore() {
  const coinsEl = document.getElementById('sm-coins');
  const pullsEl = document.getElementById('sm-pulls-total');
  const msgEl   = document.getElementById('sm-msg');
  if (coinsEl) coinsEl.textContent = smCoins;
  if (pullsEl) pullsEl.textContent = smTotalPulls;

  if (msgEl) {
    const n = smTotalPulls;
    if (n === 0) {
      msgEl.textContent = 'Pull an arm to start exploring.';
    } else if (n < 8) {
      msgEl.textContent = 'Not enough data yet — keep pulling.';
    } else if (n < 20) {
      msgEl.textContent = 'Patterns emerging. Which machine looks best?';
    } else {
      const pulled = smMachines.filter(m => m.pulls > 0);
      const best   = pulled.reduce((b, m) => m.wins / m.pulls > b.wins / b.pulls ? m : b, pulled[0]);
      msgEl.textContent = `Machine ${best.label} looks strongest — but uncertainty remains.`;
    }
  }
}


// ── Reset ─────────────────────────────────────────────────────────

function smReset() {
  smMachines.forEach(m => { m.pulls = 0; m.wins = 0; m.busy = false; });
  smCoins      = SM_START;
  smTotalPulls = 0;

  smMachines.forEach((_, i) => {
    [0, 1, 2].forEach(r => {
      const el = document.getElementById(`sm-r-${i}-${r}`);
      if (el) el.textContent = '7';
    });
    const stat  = document.getElementById(`sm-stat-${i}`);
    if (stat)  stat.textContent = '0 pulls';
    const flash = document.getElementById(`sm-flash-${i}`);
    if (flash) flash.className = 'sm-flash';
    smDrawDist(i);
  });
  smRefreshScore();
}


// ── Beta distribution canvas ──────────────────────────────────────
// Shows a Bayesian posterior (Beta(wins+1, losses+1)) for each
// machine, updating live. Starts flat (uniform prior), narrows
// and shifts as evidence accumulates.

function smDrawDist(idx) {
  const m      = smMachines[idx];
  const canvas = document.getElementById(`sm-dist-${idx}`);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const α   = m.wins + 1;
  const β   = m.pulls - m.wins + 1;
  const N   = 80;
  const pad = 3;

  // Evaluate unnormalized beta PDF
  const pts = [];
  let peak = 0;
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    const y = Math.pow(x + 1e-9, α - 1) * Math.pow(1 - x + 1e-9, β - 1);
    pts.push(y);
    if (y > peak) peak = y;
  }

  const px = i => pad + (i / N) * (W - 2 * pad);
  const py = y => (H - pad) - Math.min(1, y / peak) * (H - 2 * pad);

  // Filled area
  ctx.beginPath();
  ctx.moveTo(px(0), H - pad);
  pts.forEach((y, i) => ctx.lineTo(px(i), py(y)));
  ctx.lineTo(px(N), H - pad);
  ctx.closePath();
  ctx.fillStyle = m.color + '55';
  ctx.fill();

  // Curve line
  ctx.beginPath();
  pts.forEach((y, i) => i === 0 ? ctx.moveTo(px(i), py(y)) : ctx.lineTo(px(i), py(y)));
  ctx.strokeStyle = m.dark;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Baseline
  ctx.beginPath();
  ctx.moveTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.strokeStyle = '#D8DEE4';
  ctx.lineWidth   = 1;
  ctx.stroke();
}


// ── Build DOM ─────────────────────────────────────────────────────

function smBuild() {
  const row = document.getElementById('sm-machines-row');
  if (!row) return;

  row.innerHTML = smMachines.map((m, i) => `
    <div class="sm-col">
      <div class="sm-dist-label">Belief</div>
      <canvas id="sm-dist-${i}" class="sm-dist-canvas" width="112" height="56"></canvas>
      <div class="sm-machine" id="sm-machine-${i}"
           style="--smc:${m.color};--smd:${m.dark}"
           onclick="smPull(${i})" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')smPull(${i})"
           aria-label="Pull Machine ${m.label}">
        <div class="sm-label-top">Machine ${m.label}</div>
        <div class="sm-window">
          <span class="sm-reel" id="sm-r-${i}-0">7</span>
          <span class="sm-win-div">|</span>
          <span class="sm-reel" id="sm-r-${i}-1">7</span>
          <span class="sm-win-div">|</span>
          <span class="sm-reel" id="sm-r-${i}-2">7</span>
        </div>
        <div class="sm-flash" id="sm-flash-${i}"></div>
        <div class="sm-stat" id="sm-stat-${i}">0 pulls</div>
        <div class="sm-lever-wrap">
          <div class="sm-arm" id="sm-arm-${i}">
            <div class="sm-arm-shaft"></div>
            <div class="sm-arm-ball"></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  smMachines.forEach((_, i) => smDrawDist(i));
}


// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  smBuild();
  smRefreshScore();
});
