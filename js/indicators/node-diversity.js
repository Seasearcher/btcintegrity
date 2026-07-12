// Indicator 6: Node Software Diversity
// Source: bitaccelerate.net client snapshot

import { fetchJSON }        from '../utils/fetch-cache.js';
import { scoreFromAnchors } from '../utils/normalize.js';

const ENDPOINT = 'https://bitaccelerate.net/api/nodes-clients.json';

// Composite-score anchors: [dominant client share %, score]. Lower is better.
//
// NOTE: the badge below uses richer editorial logic (it also flags rapid
// fragmentation, e.g. Knots > 20%, as "Watch"). For the composite we need a
// monotonic scalar, so the score tracks only dominant-client share:
// monoculture risk. The two can legitimately disagree at the margins.
const DOMINANT_ANCHORS = [
  [50,  100],
  [70,  80],
  [90,  60],   // badge "Concentrated" boundary
  [100, 20],
];

export async function updateNodeDiversity() {
  const valueEl    = document.getElementById('node-diversity-value');
  const subtitleEl = document.getElementById('node-diversity-subtitle');
  const badgeEl    = document.getElementById('node-diversity-badge');
  const barCore    = document.getElementById('node-diversity-bar-core');
  const barKnots   = document.getElementById('node-diversity-bar-knots');
  const barOther   = document.getElementById('node-diversity-bar-other');

  try {
    const json = await fetchJSON(ENDPOINT);

    const { labels, data, meta } = json;
    if (!Array.isArray(labels) || !Array.isArray(data) || labels.length !== data.length) {
      throw new Error('Unexpected response shape');
    }

    const counts = Object.fromEntries(labels.map((l, i) => [l, data[i]]));
    const total = data.reduce((a, b) => a + b, 0);
    if (total === 0) throw new Error('Empty snapshot');

    const core  = counts['Bitcoin Core']  ?? 0;
    const knots = counts['Bitcoin Knots'] ?? 0;
    const other = total - core - knots; // includes Unknown + minor implementations

    const pct = n => (n / total) * 100;
    const corePct  = pct(core);
    const knotsPct = pct(knots);
    const otherPct = pct(other);

    if (barCore)  barCore.style.width  = corePct.toFixed(2)  + '%';
    if (barKnots) barKnots.style.width = knotsPct.toFixed(2) + '%';
    if (barOther) barOther.style.width = otherPct.toFixed(2) + '%';

    if (valueEl) {
      valueEl.innerHTML =
        `<span class="text-orange-400">${corePct.toFixed(1)}%</span>` +
        `<span class="text-slate-500 mx-1">/</span>` +
        `<span class="text-purple-400">${knotsPct.toFixed(1)}%</span>` +
        `<span class="text-slate-500 mx-1">/</span>` +
        `<span class="text-slate-400">${otherPct.toFixed(1)}%</span>`;
    }

    const ageHrs = meta?.timestamp
      ? ((Date.now() / 1000 - meta.timestamp) / 3600).toFixed(1)
      : null;
    if (subtitleEl) {
      subtitleEl.textContent =
        `${total.toLocaleString()} listening nodes` +
        (ageHrs ? ` · updated ${ageHrs}h ago` : '');
    }

    let badgeText, badgeClass;
    if (corePct > 90 || knotsPct > 90) {
      badgeText = 'Concentrated';
      badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
    } else if (knotsPct > 20 || corePct < 70) {
      badgeText = 'Watch';
      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else {
      badgeText = 'Healthy';
      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (badgeEl) {
      badgeEl.textContent = badgeText;
      badgeEl.className = 'text-xs px-2 py-1 rounded border ' + badgeClass;
    }

    // --- Composite score: dominant-client share (monoculture risk) ---
    const dominantShare = Math.max(corePct, knotsPct);
    const score = scoreFromAnchors(dominantShare, DOMINANT_ANCHORS);

    console.log(
      `✅ Node Software Diversity: Core ${corePct.toFixed(1)}% / ` +
      `Knots ${knotsPct.toFixed(1)}% / Other ${otherPct.toFixed(1)}% — ${badgeText}, ` +
      `dominant ${dominantShare.toFixed(1)}%, score ${Math.round(score)}`
    );

    return {
      key:   'nodeDiversity',
      label: 'node software diversity',
      raw:   dominantShare,
      score,
      status: badgeText,
    };

  } catch (err) {
    console.error('Node Software Diversity indicator failed:', err);
    if (valueEl)    valueEl.textContent    = '—';
    if (subtitleEl) subtitleEl.textContent = 'Data source unavailable';
    if (badgeEl)    badgeEl.textContent    = '—';
    throw err; // re-throw so main.js and the composite see the failure
  }
}
