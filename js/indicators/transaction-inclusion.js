export async function updateTransactionInclusion() {
  try {
    const res = await fetch('https://mempool.space/api/v1/mining/pools/1w');
    if (!res.ok) throw new Error('mempool.space API error: ' + res.status);
    const data = await res.json();

    const pools = data.pools || [];
    if (pools.length === 0) throw new Error('No pool data returned');

    // --- 1. Compute weighted match rate (excluding "Unknown" pool) ---
    let totalBlocks = 0;
    let trackedBlocks = 0;
    let weightedSum = 0;
    let predictableBlocks = 0;

    pools.forEach(p => {
      totalBlocks += p.blockCount;
      if (p.slug === 'unknown') return;
      trackedBlocks += p.blockCount;
      weightedSum += p.blockCount * p.avgMatchRate;
      if (p.avgMatchRate >= 95) predictableBlocks += p.blockCount;
    });

    const matchRate = weightedSum / trackedBlocks;
    const predictableShare = (predictableBlocks / trackedBlocks) * 100;

    // --- 2. Determine status ---
    let label, badgeClasses, valueColor;
    if (matchRate >= 98) {
      label = 'Healthy';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      valueColor = 'text-emerald-400';
    } else if (matchRate >= 95) {
      label = 'Watch';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20';
      valueColor = 'text-amber-400';
    } else {
      label = 'Concern';
      badgeClasses = 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20';
      valueColor = 'text-rose-400';
    }

    // --- 3. Update DOM ---
    const valueEl = document.getElementById('transaction-inclusion-value');
    valueEl.textContent = matchRate.toFixed(2) + '%';
    valueEl.className = 'text-3xl font-bold mono ' + valueColor;

    const badge = document.getElementById('transaction-inclusion-badge');
    badge.textContent = label;
    badge.className = badgeClasses;

    document.getElementById('transaction-inclusion-blocks').textContent =
      totalBlocks.toLocaleString();
    document.getElementById('transaction-inclusion-predictable').textContent =
      predictableShare.toFixed(1) + '%';

    // --- 4. Render per-pool bars ---
    drawPoolBars(pools.filter(p => p.slug !== 'unknown'));

  } catch (err) {
    console.error('Transaction Inclusion indicator failed:', err);
    const v = document.getElementById('transaction-inclusion-value');
    if (v) v.textContent = '—';
  }
}

function drawPoolBars(pools) {
  const g = document.getElementById('transaction-inclusion-bars');
  if (!g) return;

  // Match the SVG viewBox: 200 wide × 50 tall
  const W = 200;
  const H = 50;
  const GAP = 0.6;

  const sorted = [...pools].sort((a, b) => b.blockCount - a.blockCount);
  const totalBlocks = sorted.reduce((sum, p) => sum + p.blockCount, 0);

  // Clamp y-axis to [80, 100] so variation is visible
  const Y_MIN = 80;
  const Y_MAX = 100;
  const yScale = rate => {
    const clamped = Math.max(Y_MIN, Math.min(Y_MAX, rate));
    return H - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * H;
  };

  // Match the Tailwind palette used elsewhere
  const colorFor = rate => {
    if (rate >= 98) return '#34d399';   // emerald-400
    if (rate >= 95) return '#fbbf24';   // amber-400
    return '#fb7185';                   // rose-400
  };

  g.innerHTML = '';

  let x = 0;
  sorted.forEach(p => {
    const w = (p.blockCount / totalBlocks) * W;
    const yTop = yScale(p.avgMatchRate);
    const h = H - yTop;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x.toFixed(2));
    rect.setAttribute('y', yTop.toFixed(2));
    rect.setAttribute('width', Math.max(0, w - GAP).toFixed(2));
    rect.setAttribute('height', h.toFixed(2));
    rect.setAttribute('fill', colorFor(p.avgMatchRate));
    rect.setAttribute('opacity', '0.85');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${p.name}: ${p.avgMatchRate.toFixed(2)}% match (${p.blockCount} blocks)`;
    rect.appendChild(title);

    g.appendChild(rect);
    x += w;
  });
}
