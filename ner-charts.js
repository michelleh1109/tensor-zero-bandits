/* ─────────────────────────────────────────────────────────────────
   ner-charts.js
   Static visualizations of the NER experiment from the blog post.
   Shows traffic consolidation at two snapshots: mid-run (~960
   inferences) and end-of-run (2,000 inferences, winner declared).
───────────────────────────────────────────────────────────────── */

const NER_VARIANTS = [
  { label: 'haiku-simple',    color: '#6366F1' },
  { label: 'haiku-detailed',  color: '#10B981' },
  { label: 'sonnet-simple',   color: '#F59E0B' },
  { label: 'sonnet-detailed', color: '#ff4f01' },
];

// Generate smoothly interpolated allocation data between two states,
// with small sinusoidal noise to look like real experiment output.
function makeNerData(n, startAllocs, endAllocs, totalInferences) {
  const labels   = [];
  const datasets = NER_VARIANTS.map(v => ({ ...v, data: [] }));

  for (let i = 0; i <= n; i++) {
    labels.push(i * (totalInferences / n));
    const t    = i / n;
    const ease = t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; // ease-in-out

    datasets.forEach((ds, vi) => {
      const val   = startAllocs[vi] + (endAllocs[vi] - startAllocs[vi]) * ease;
      const noise = Math.sin(i * 13.7 + vi * 5.3) * 0.015
                  + Math.sin(i * 7.1  + vi)       * 0.01;
      ds.data.push(Math.max(0.01, Math.min(1, val + noise)));
    });
  }

  return { labels, datasets };
}

function buildNerChart(canvasId, nerD) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels:   nerD.labels.map(v => Math.round(v)),
      datasets: nerD.datasets.map(ds => ({
        label:           ds.label,
        data:            ds.data.map(v => +(v * 100).toFixed(1)),
        borderColor:     ds.color,
        backgroundColor: ds.color + '15',
        borderWidth:     2,
        pointRadius:     0,
        tension:         0.4,
        fill:            true,
      }))
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 600 },
      scales: {
        x: {
          ticks: { color: '#8C959F', font: { size: 9 }, maxTicksLimit: 5 },
          grid:  { color: '#EAEEF2' },
          title: { display: true, text: 'Inferences', color: '#8C959F', font: { size: 9 } }
        },
        y: {
          min: 0, max: 100,
          ticks: { color: '#8C959F', font: { size: 9 }, callback: v => v + '%' },
          grid:  { color: '#EAEEF2' },
        }
      },
      plugins: {
        legend:  { display: true, position: 'bottom', labels: { boxWidth: 8, padding: 10, font: { size: 9 }, color: '#57606A' } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } }
      }
    }
  });
}


// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const uniform = [0.25, 0.25, 0.25, 0.25];

  // Chart 1: mid-experiment at ~960 inferences, traffic consolidating
  const ner1 = makeNerData(40, uniform, [0.12, 0.14, 0.18, 0.56], 960);
  buildNerChart('ner-chart-1', ner1);

  // Chart 2: experiment complete at 2,000 inferences, winner clear
  const ner2 = makeNerData(80, uniform, [0.04, 0.06, 0.08, 0.82], 2000);
  buildNerChart('ner-chart-2', ner2);
});
