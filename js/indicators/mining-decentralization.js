// Indicator 3: Mining Decentralization
// Source: mempool.space pool share data (1w window)
// Measures: HHI of pool block shares + Nakamoto coefficient

import { fetchJSON }        from '../utils/fetch-cache.js';
import { scoreFromAnchors } from '../utils/normalize.js';
import { MEMPOOL_POOLS_1W } from '../utils/endpoints.js';

// Composite-score anchors. The badge uses OR logic across HHI and the
// Nakamoto coefficient; the composite preserves the same weakest-link
// semantics by taking the MINIMUM of the two sub-scores.
//
// HHI (lower is better): Healthy boundary (0.15) → 80, Concern boundary (0.25) → 60.
const HHI_ANCHORS = [
  [0.05, 100],
  [0.15, 80],
  [0.25, 60],
  [0.6,  0],
];

// Nakamoto coefficient (higher is better): ≤2 is Concern, 3 is Watch.
const NAKAMOTO_ANCHORS = [
  [1, 0],
  [2, 30],
  [3, 65],
  [4, 80],
  [6, 100],
];

export async function updateMiningDecentralization() {
  const valueEl = document.getElementById('mining-decentralization-value');
  const badge   = document.getElementById('mining-decentralization-badge');

  try {
    const data = await fetchJSON(MEMPOOL_POOLS_1W);

    const pools = (data.pools || []).filter(p => p.slug !== 'unknown');
    if (pools.length === 0) throw new Error('No pool data returned');

    const totalBlocks = pools.reduce((s, p) => s + p.blockCount, 0);

    // Sort by share descending
    const sorted = [...pools].sort((a, b) => b.blockCount - a.blockCount);
    const shares = sorted.map(p => ({
      name: p.name,
      blocks: p.blockCount,
      share: p.blockCount / totalBlocks
    }));

    // --- HHI (sum of squared shares; range 0–1) ---
    const hhi = shares.reduce((s, p) => s + p.share * p.share, 0);

    // --- Nakamoto coefficient (min pools to exceed 50%) ---
    let cumulative = 0;
    let nakamoto = 0;
    for (const p of shares) {
      cumulative += p.share;
      nakamoto++;
      if (cumulative > 0.5) break;
    }
    const top50Share = cumulative; // share controlled by the Nakamoto-N set

    // --- Status ---
    let label, badgeClasses, valueColor, barAccent;
    const concern = hhi > 0.25 || nakamoto <= 2;
    const watch = hhi >= 0.15 || nakamoto <= 3;
    if (concern) {
      label = 'Concern';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20';
      valueColor = 'text-rose-400';
      barAccent = '#fb7185';
    } else if (watch) {
      label = 'Watch';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20';
      valueColor = 'text-amber-400';
      barAccent = '#fbbf24';
    } else {
      label = 'Healthy';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      valueColor = 'text-emerald-400';
      barAccent = '#34d399';
    }

    // --- DOM updates ---
    if (valueEl) {
      valueEl.textContent = hhi.toFixed(3);
      valueEl.className = 'text-3xl font-bold mono ' + valueColor;
    }

    if (badge) {
      badge.textContent = label;
      badge.className = badgeClasses;
      badge.style.opacity = '1';
    }

    // --- Description ---
    const topNames = shares.slice(0, nakamoto).map(p => p.name);
    const fmtList = arr =>
      arr.length === 1 ? arr[0] :
      arr.length === 2 ? `${arr[0]} and ${arr[1]}` :
      `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;

    const desc =
  `<strong>${nakamoto}</strong> pools (${fmtList(topNames)}) account for ` +
  `<strong>${(top50Share * 100).toFixed(1)}%</strong> of blocks over the last week. ` +
  `Template-provider concentration may be higher than visible pool shares suggest.`;

    const descEl = document.getElementById('mining-decentralization-description');
    if (descEl) descEl.innerHTML = desc;

    // --- Stacked share bar ---
    drawShareBar(shares, barAccent, nakamoto);

    // --- Composite score: weakest link of the two sub-metrics ---
    const hhiScore      = scoreFromAnchors(hhi, HHI_ANCHORS);
    const nakamotoScore = scoreFromAnchors(nakamoto, NAKAMOTO_ANCHORS);
    const score         = Math.min(hhiScore, nakamotoScore);

    console.log(
      `✅ Mining Decentralization: HHI ${hhi.toFixed(3)}, Nakamoto ${nakamoto} ` +
      `(${label}, score ${Math.round(score)} = min(${Math.round(hhiScore)}, ${Math.round(nakamotoScore)}))`
    );

    return {
      key:   'miningDecentralization',
      label: 'mining decentralization',
      raw:   { hhi, nakamoto },
      score,
      status: label,
    };

  } catch (err) {
    console.error('⚠️ Mining Decentralization indicator failed:', err);
    if (valueEl) valueEl.textContent = '—';
    if (badge) {
      badge.title         = 'Live data unavailable';
      badge.style.opacity = '0.6';
    }
    throw err; // re-throw so main.js and the composite see the failure
  }
}

function drawShareBar(shares, accent, nakamoto) {
  const g = document.getElementById('mining-decentralization-bar');
  if (!g) return;

  const W = 200;
  const H = 16;
  const Y = (50 - H) / 2;
  const GAP = 0.5;

  g.innerHTML = '';

  let x = 0;
  shares.forEach((p, i) => {
    const w = p.share * W;
    const inTopSet = i < nakamoto;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x.toFixed(2));
    rect.setAttribute('y', Y);
    rect.setAttribute('width', Math.max(0, w - GAP).toFixed(2));
    rect.setAttribute('height', H);
    rect.setAttribute('fill', inTopSet ? accent : '#475569'); // slate-600 for tail
    rect.setAttribute('opacity', inTopSet ? '0.9' : '0.6');
    rect.setAttribute('rx', '1');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.name}: ${(p.share * 100).toFixed(1)}% (${p.blocks} blocks)`;
    rect.appendChild(title);

    g.appendChild(rect);
    x += w;
  });

  // 50% reference line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', W * 0.5);
  line.setAttribute('x2', W * 0.5);
  line.setAttribute('y1', Y - 3);
  line.setAttribute('y2', Y + H + 3);
  line.setAttribute('stroke', '#e2e8f0'); // slate-200
  line.setAttribute('stroke-width', '0.75');
  line.setAttribute('stroke-dasharray', '2,2');
  g.appendChild(line);
}
