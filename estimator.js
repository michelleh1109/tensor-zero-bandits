/* ─────────────────────────────────────────────────────────────────
   estimator.js
   Experiment Duration Estimator — drives the δ/ε slider interactive
   in Section 4. Outputs illustrative (not precise) sample counts to
   make the parameter tradeoff immediately tangible.
───────────────────────────────────────────────────────────────── */

// Calibrated heuristic based on 4-variant Bernoulli experiments.
// Exact durations depend on the true performance gaps (unknown in
// practice), so these numbers are intentionally illustrative.
//
// Key relationships:
//   adaptive  ∝ log(1/δ) / ε²   (fewer samples with larger ε or δ)
//   uniform   ≈ adaptive × 1.45  (~37% more samples on average)

const EST_BASE       = 400;   // inferences for a 2-arm comparison at δ=0.05, ε=0.05
const EST_ARMS_SCALE = 1.8;   // 4 arms ≈ 1.8× overhead vs 2 arms

function estimateDuration(delta, eps) {
  const deltaScale = Math.log(1 / delta) / Math.log(1 / 0.05);
  const epsScale   = eps > 0.001 ? (0.05 / eps) * 0.8 + 0.2 : 3.5;

  const adaptRaw   = EST_BASE * EST_ARMS_SCALE * deltaScale * epsScale;
  const adaptive   = Math.max(80,  Math.round(adaptRaw / 50) * 50);
  const uniform    = Math.max(120, Math.round(adaptive * 1.45 / 50) * 50);
  const savings    = Math.round((1 - adaptive / uniform) * 100);

  return { adaptive, uniform, savings };
}

function updateEstimator() {
  const delta = +document.getElementById('delta-slider').value / 100;
  const eps   = +document.getElementById('eps-slider').value   / 100;

  document.getElementById('delta-val').textContent = delta.toFixed(2);
  document.getElementById('eps-val').textContent   = eps.toFixed(2);

  const { adaptive, uniform, savings } = estimateDuration(delta, eps);

  document.getElementById('est-adaptive').textContent = adaptive.toLocaleString();
  document.getElementById('est-uniform').textContent  = uniform.toLocaleString();
  document.getElementById('est-badge').textContent    = `~${savings}% fewer samples`;
}


// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateEstimator();
});
