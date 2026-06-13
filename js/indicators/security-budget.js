// Indicator 2: Security Budget
// Annualized miner revenue ÷ market cap

const STATUS = {
  HEALTHY:  {
    label: 'Healthy',
    classes: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueColor: 'text-emerald-400',
    sparkColor: '#34d399',
  },
  CONCERN:  {
    label: 'Concern',
    classes: 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20',
    valueColor: 'text-amber-400',
    sparkColor: '#fbbf24',
  },
  CRITICAL: {
    label: 'Critical',
    classes: 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20',
    valueColor: 'text-rose-400',
    sparkColor: '#fb7185',
  },
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

function buildSparkPaths(values, width = 200, height = 50) {
  if (!values?.length) return { line: '', area: '' };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return [x, y];
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area };
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

  // --- Update DOM (matching the actual IDs in index.html) ---
  const valueEl   = document.getElementById('security-budget-value');
  const badgeEl   = document.getElementById('security-budget-badge');
  const costEl    = document.getElementById('security-budget-attack-cost');
  const sparkLine = document.getElementById('security-budget-spark-line');
  const sparkArea = document.getElementById('security-budget-spark-area');

  if (valueEl) {
    valueEl.textContent = `${ratioPct.toFixed(2)}%`;
    valueEl.className = `text-3xl font-bold mono ${status.valueColor}`;
  }

  if (badgeEl) {
    badgeEl.textContent = status.label;
    badgeEl.className = status.classes;
  }

  if (costEl) {
    costEl.textContent = formatUSD(hourlyAttackCost);
  }

  if (sparkData && sparkLine && sparkArea) {
    const values = sparkData.values.map(p => p.y);
    const { line, area } = buildSparkPaths(values);
    sparkLine.setAttribute('d', line);
    sparkLine.setAttribute('stroke', status.sparkColor);
    sparkArea.setAttribute('d', area);
    sparkArea.setAttribute('fill', status.sparkColor);
  }

  console.log(`✅ Security Budget: ${ratioPct.toFixed(2)}% (${status.label}) — attack cost ~${formatUSD(hourlyAttackCost)}/hr`);
}
