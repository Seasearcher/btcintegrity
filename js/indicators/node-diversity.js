// node-diversity.js
const ENDPOINT = 'https://bitaccelerate.net/api/nodes-clients.json';

export async function updateNodeDiversity() {
  const valueEl    = document.getElementById('node-diversity-value');
  const subtitleEl = document.getElementById('node-diversity-subtitle');
  const badgeEl    = document.getElementById('node-diversity-badge');
  const barCore    = document.getElementById('node-diversity-bar-core');
  const barKnots   = document.getElementById('node-diversity-bar-knots');
  const barOther   = document.getElementById('node-diversity-bar-other');

  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

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

    barCore.style.width  = corePct.toFixed(2)  + '%';
    barKnots.style.width = knotsPct.toFixed(2) + '%';
    barOther.style.width = otherPct.toFixed(2) + '%';

valueEl.innerHTML =
  `<span class="text-orange-400">${corePct.toFixed(1)}%</span>` +
  `<span class="text-slate-500 mx-1">/</span>` +
  `<span class="text-purple-400">${knotsPct.toFixed(1)}%</span>` +
  `<span class="text-slate-500 mx-1">/</span>` +
  `<span class="text-slate-400">${otherPct.toFixed(1)}%</span>`;


    const ageHrs = meta?.timestamp
      ? ((Date.now() / 1000 - meta.timestamp) / 3600).toFixed(1)
      : null;
    subtitleEl.textContent =
      `${total.toLocaleString()} listening nodes` +
      (ageHrs ? ` · updated ${ageHrs}h ago` : '');

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
    badgeEl.textContent = badgeText;
    badgeEl.className = 'text-xs px-2 py-1 rounded border ' + badgeClass;

    console.log(
      `✅ Node Software Diversity: Core ${corePct.toFixed(1)}% / ` +
      `Knots ${knotsPct.toFixed(1)}% / Other ${otherPct.toFixed(1)}% — ${badgeText}`
    );
  } catch (err) {
    console.error('Node Software Diversity indicator failed:', err);
    valueEl.textContent    = '—';
    subtitleEl.textContent = 'Data source unavailable';
    badgeEl.textContent    = '—';
  }
}
