// Indicator 2: Security Budget
// Annualized miner revenue ÷ market cap

import { renderSparkline }   from '../utils/sparkline.js';
import { fetchJSON }         from '../utils/fetch-cache.js';
import { scoreFromAnchors }  from '../utils/normalize.js';
import { COINGECKO_BITCOIN } from '../utils/endpoints.js';

const ENDPOINTS = {
  revenue30d: 'https://api.blockchain.info/charts/miners-revenue?timespan=30days&format=json&cors=true',
  revenue1y:  'https://api.blockchain.info/charts/miners-revenue?timespan=1year&format=json&cors=true',
};

const STATUS = {
  HEALTHY: {
    label: 'Healthy',
    classes: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueColor: 'text-emerald-400',
    sparkColor: '#34d399',
  },
  WATCH: {
    label: 'Watch',
    classes: 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20',
    valueColor: 'text-amber-400',
    sparkColor: '#fbbf24',
  },
  CONCERN: {
    label: 'Concern',
    classes: 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20',
    valueColor: 'text-rose-400',
    sparkColor: '#fb7185',
  },
};

// Composite-score anchors: [annualized revenue / mcap %, score].
// Aligned with getStatus(): Watch boundary (0.50) → 60, Healthy (0.75) → 80.
const ANCHORS = [
  [0,    0],
  [0.50, 60],
  [0.75, 80],
  [1.5,  100],
];

function getStatus(ratioPct) {
  if (ratioPct >= 0.75) return STATUS.HEALTHY;
  if (ratioPct >= 0.50) return STATUS.WATCH;
  return STATUS.CONCERN;
}

function formatUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export async function updateSecurityBudget() {
  const badgeEl = document.getElementById('security-budget-badge');

  try {
    // --- Fetch data (the 1-year sparkline series is optional) ---
    const [revenueData, mcapData, sparkData] = await Promise.all([
      fetchJSON(ENDPOINTS.revenue30d),
      fetchJSON(COINGECKO_BITCOIN),
      fetchJSON(ENDPOINTS.revenue1y).catch(err => {
        console.warn('Security Budget: sparkline series unavailable:', err);
        return null;
      }),
    ]);

    // --- Compute metric ---
    const dailyRevenues = revenueData.values.map(p => p.y);
    const avgDailyRevenue = dailyRevenues.reduce((a, b) => a + b, 0) / dailyRevenues.length;
    const annualizedRevenue = avgDailyRevenue * 365;
    const marketCap = mcapData.market_data.market_cap.usd;

    const ratioPct = (annualizedRevenue / marketCap) * 100;
    const hourlyAttackCost = avgDailyRevenue / 24;

    // --- Status ---
    const status = getStatus(ratioPct);

    // --- Update DOM ---
    const valueEl = document.getElementById('security-budget-value');
    const costEl  = document.getElementById('security-budget-attack-cost');

    if (valueEl) {
      valueEl.textContent = `${ratioPct.toFixed(2)}%`;
      valueEl.className = `text-3xl font-bold mono ${status.valueColor}`;
    }

    if (badgeEl) {
      badgeEl.textContent   = status.label;
      badgeEl.className     = status.classes;
      badgeEl.style.opacity = '1';
    }

    if (costEl) {
      costEl.textContent = formatUSD(hourlyAttackCost);
    }

    // --- Sparkline (via the shared renderer, consistent with fee-market) ---
    if (sparkData?.values?.length) {
      renderSparkline({
        lineId: 'security-budget-spark-line',
        areaId: 'security-budget-spark-area',
        points: sparkData.values.map(p => p.y),
        color:  status.sparkColor,
      });
    }

    const score = scoreFromAnchors(ratioPct, ANCHORS);

    console.log(
      `✅ Security Budget: ${ratioPct.toFixed(2)}% (${status.label}, score ${Math.round(score)}) ` +
      `— attack cost ~${formatUSD(hourlyAttackCost)}/hr`
    );

    return {
      key:   'securityBudget',
      label: 'the security budget',
      raw:   ratioPct,
      score,
      status: status.label,
    };

  } catch (err) {
    console.error('⚠️ Security Budget update failed:', err);
    if (badgeEl) {
      badgeEl.title         = 'Live data unavailable';
      badgeEl.style.opacity = '0.6';
    }
    throw err;
  }
}
