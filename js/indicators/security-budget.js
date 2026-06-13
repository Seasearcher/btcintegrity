// Indicator 2: Security Budget
// Annualized miner revenue ÷ market cap

const STATUS = {
  HEALTHY:  { label: 'Healthy',  className: 'healthy'  },
  CONCERN:  { label: 'Concern',  className: 'concern'  },
  CRITICAL: { label: 'Critical', className: 'critical' },
};

function getStatus(ratioPct) {
  if (ratioPct >= 0.75) return STATUS.HEALTHY;
  if (ratioPct >= 0.50) return STATUS.CONCERN;
  return STATUS.CRITICAL;
}

function formatUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function renderSparkline(svgEl, values) {
  if (!svgEl || !values?.length) return;
  const w = 300, h = 40, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.innerHTML = `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" />`;
}

export async function updateSecurityBudget() {
  // --- Fetch data ---
  const [revenueRes, mcapRes, sparkRes] = await Promise.all([
    fetch('https://api.blockchain.info/charts/miners-revenue?timespan=30days&format=json&cors=true'),
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false'),
    fetch('https://api.blockchain.info/charts/miners-revenue?timespan=1year&format=json&cors=true'),
  ]);

  if (!revenueRes.ok || !mcapRes.ok) throw new Error('Security Budget API fetch failed');

  const revenueData = await revenueRes.json();
  const mcapData    = await mcapRes.json();
  const sparkData   = sparkRes.ok ? await sparkRes.json() : null;

  // --- Compute metric ---
  const dailyRevenues = revenueData.values.map(p => p.y);
  const avgDailyRevenue = dailyRevenues.reduce((a, b) => a + b, 0) / dailyRevenues.length;
  const annualizedRevenue = avgDailyRevenue * 365;
  const marketCap = mcapData.market_data.market_cap.usd;

  const ratioPct = (annualizedRevenue / marketCap) * 100;
  const hourlyAttackCost = avgDailyRevenue / 24;

  // --- Status ---
  const status = getStatus(ratioPct);

  // --- Narrative (Option B) ---
  const narrative =
    `Attackers must outspend ~${formatUSD(hourlyAttackCost)}/hour and sustain it for hours or days. ` +
    `Security spend relative to market cap; trends downward at each halving and must be replaced by fees long-term.`;

  // --- Update DOM ---
  const valueEl     = document.getElementById('security-budget-value');
  const statusEl    = document.getElementById('security-budget-status');
  const narrativeEl = document.getElementById('security-budget-narrative');
  const sparkEl     = document.getElementById('security-budget-sparkline');

  if (valueEl)     valueEl.textContent = `${ratioPct.toFixed(2)}%`;
  if (statusEl) {
    statusEl.textContent = status.label;
    statusEl.className = `status-pill ${status.className}`;
  }
  if (narrativeEl) narrativeEl.textContent = narrative;
  if (sparkEl && sparkData) {
    renderSparkline(sparkEl, sparkData.values.map(p => p.y));
  }

  console.log(`✅ Security Budget: ${ratioPct.toFixed(2)}% (${status.label}) — attack cost ~${formatUSD(hourlyAttackCost)}/hr`);
}
