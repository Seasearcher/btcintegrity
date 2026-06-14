// Indicator 6: Node Software Diversity
// Source: Bitnodes (https://bitnodes.io/api/v1/snapshots/latest/)
// Measures: distribution of node implementations among reachable nodes

const STATUS = {
  HEALTHY: {
    label: 'Healthy',
    classes: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueColor: 'text-emerald-400',
  },
  WATCH: {
    label: 'Watch',
    classes: 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20',
    valueColor: 'text-amber-400',
  },
  CONCERN: {
    label: 'Concern',
    classes: 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20',
    valueColor: 'text-rose-400',
  },
};

// Classify a Bitnodes user_agent string into one of three buckets.
// Order matters: Knots advertises itself with a Satoshi-prefix too,
// so we have to test for "knots" first.
function classify(userAgent) {
  if (!userAgent) return 'other';
  const ua = userAgent.toLowerCase();
  if (ua.includes('knots')) return 'knots';
  if (ua.startsWith('/satoshi:')) return 'core';
  return 'other';
}

// Status thresholds:
//   - Heavy monoculture (Core ≥ 95%) → Watch
//   - A non-Core implementation gaining ≥ 30% share → Watch (consensus-split risk)
//   - A non-Core implementation ≥ 50% → Concern
//   - Otherwise → Healthy
function getStatus(corePct, knotsPct, otherPct) {
  const largestNonCore = Math.max(knotsPct, otherPct);
  if (largestNonCore >= 50) return STATUS.CONCERN;
  if (largestNonCore >= 30) return STATUS.WATCH;
  if (corePct >= 95)        return STATUS.WATCH;
  return STATUS.HEALTHY;
}

export async function updateNodeDiversity() {
  try {
    const res = await fetch('https://bitnodes.io/api/v1/snapshots/latest/');
    if (!res.ok) throw new Error('Bitnodes API error: ' + res.status);
    const data = await res.json();

    const nodes = data.nodes || {};
    let core = 0, knots = 0, other = 0, total = 0;

    for (const key in nodes) {
      // nodes[key] is an array; index 1 is the user_agent string.
      const userAgent = nodes[key][1];
      const cls = classify(userAgent);
      if      (cls === 'core')  core++;
      else if (cls === 'knots') knots++;
      else                      other++;
      total++;
    }

    if (total === 0) throw new Error('No nodes returned');

    const corePct  = (core  / total) * 100;
    const knotsPct = (knots / total) * 100;
    const otherPct = (other / total) * 100;

    const status = getStatus(corePct, knotsPct, otherPct);

    // --- Headline number ---
    const valueEl = document.getElementById('node-diversity-value');
    valueEl.textContent =
      `${Math.round(corePct)} / ${Math.round(knotsPct)} / ${Math.round(otherPct)}`;
    valueEl.className = 'text-3xl font-bold mono ' + status.valueColor;

    // --- Badge ---
    const badge = document.getElementById('node-diversity-badge');
    badge.textContent = status.label;
    badge.className = status.classes;

    // --- Subtitle with sample size ---
    document.getElementById('node-diversity-subtitle').textContent =
      `Core / Knots / Other (% of ${total.toLocaleString()} reachable nodes)`;

    // --- Stacked bar widths ---
    document.getElementById('node-diversity-bar-core').style.width  = corePct.toFixed(2)  + '%';
    document.getElementById('node-diversity-bar-knots').style.width = knotsPct.toFixed(2) + '%';
    document.getElementById('node-diversity-bar-other').style.width = otherPct.toFixed(2) + '%';

    console.log(
      `✅ Node Software Diversity: ${corePct.toFixed(1)}% / ${knotsPct.toFixed(1)}% / ${otherPct.toFixed(1)}% ` +
      `(${status.label}) — ${total} reachable nodes`
    );

  } catch (err) {
    console.error('⚠️ Node Software Diversity indicator failed:', err);
    const v = document.getElementById('node-diversity-value');
    if (v) v.textContent = '—';
  }
}
