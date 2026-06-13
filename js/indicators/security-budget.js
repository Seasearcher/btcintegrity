// Indicator 2: Security Budget
// Source: mempool.space (free, open, no API key)
// Measures: annualized miner revenue as a share of total Bitcoin market cap
//
// Why this matters:
// Bitcoin's security comes from miners spending real resources to win blocks.
// The total amount they earn (subsidy + fees, annualized) is the "security
// budget" — the pool of value defending the chain. Comparing it to market cap
// shows whether security spend keeps pace with the value being secured.
//
// Key insight: BTC price cancels in the ratio. Security budget % depends only
// on (annual miner revenue in BTC) / (circulating supply in BTC). Price is
// only needed for the attack-cost dollar figure shown in the description.
//
// Trend: subsidy halves every ~4 years, so security budget mechanically falls
// at each halving unless fees grow to compensate. This indicator therefore
// pairs naturally with Indicator 1 (Fee Market Maturity).

import { renderSparkline } from '../utils/sparkline.js';

const ENDPOINTS = {
  rewards: 'https://mempool.space/api/v1/mining/blocks/rewards/3m',
  height:  'https://mempool.space/api/blocks/tip/height',
  price:   'https://mempool.space/api/v1/prices',
};

// Thresholds calibrated for the post-2024-halving era (subsidy = 3.125 BTC).
// Expect ~0.7-1.0% in normal conditions; halving 2028 will mechanically halve
// the subsidy contribution, so re-tune then.
const THRESHOLDS = {
  healthy: 0.8,  // >= 0.8%   = strong security spend
  concern: 0.4,  // 0.4-0.8%  = adequate but watch
  // < 0.4%        = critical, security spend lagging market cap
};

const BLOCKS_PER_YEAR = 52560; // 144 blocks/day × 365 days
const SATS_PER_BTC    = 1e8;
const SMOOTHING_WINDOW = 7;

const STATUS_STYLES = {
  Healthy: {
    badge: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueClass: 'text-emerald-400',
    sparkColor: '#34d399',
  },
  Concern: {
    badge: 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20',
    valueClass: 'text-amber-400',
    sparkColor: '#fbbf24',
  },
  Critical: {
    badge: 'text-xs px-2 py-1 rounded bg-rose-600/20 text-rose-300 border border-rose-600/40',
    valueClass: 'text-rose-300',
    sparkColor: '#fda4af',
  },
};

function classifyStatus(securityBudget) {
  if (securityBudget >= THRESHOLDS.healthy) return 'Healthy';
  if (securityBudget >= THRESHOLDS.concern) return 'Concern';
  return 'Critical';
}

// Compute total mined BTC supply at a given block height.
// Uses Bitcoin's exact subsidy schedule: 50 BTC, halved every 210,000 blocks.
// Returns BTC (not sats).
function calculateSupply(height) {
  let supplySats = 0;
  let subsidySats = 50 * SATS_PER_BTC;
  let remaining = height;

  while (remaining > 0 && subsidySats >= 1) {
    const blocksInEra = Math.min(remaining, 210000);
    supplySats += blocksInEra * subsidySats;
    remaining  -= blocksInEra;
    subsidySats = Math.floor(subsidySats / 2);
  }
  return supplySats / SATS_PER_BTC;
}

// Trailing rolling average — same helper as indicator-1.
function rollingAverage(values, window) {
  return values.map((_, i, arr) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

// Format a USD number compactly: $3.1M, $850K, $1.2B
function formatUSD(amount) {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export async function updateSecurityBudget() {
  const valueEl      = document.getElementById('security-budget-value');
  const badgeEl      = document.getElementById('security-budget-badge');
  const attackCostEl = document.getElementById('security-budget-attack-cost');

  if (!valueEl) {
    throw new Error('security-budget-value element not found');
  }

  try {
    const [rewardsRes, heightRes, priceRes] = await Promise.all([
      fetch(ENDPOINTS.rewards),
      fetch(ENDPOINTS.height),
      fetch(ENDPOINTS.price),
    ]);

    if (!rewardsRes.ok || !heightRes.ok || !priceRes.ok) {
      throw new Error('mempool.space API returned non-OK status');
    }

    const rewardsData = await rewardsRes.json();
    const currentHeight = await heightRes.json();
    const priceData = await priceRes.json();

    if (!rewardsData.length) {
      throw new Error('mempool.space API returned empty rewards data');
    }

    const priceUSD = priceData.USD || 0;
    if (priceUSD === 0) {
      throw new Error('No USD price available');
    }

    // === Headline number: current security budget ===
    // Use the average reward across the most recent buckets for stability.
    // Each bucket's avgRewards is sats per block; we annualize directly.
    const recentBuckets = rewardsData.slice(-7); // last ~week's worth
    const avgRewardSats = recentBuckets.reduce((sum, b) => sum + b.avgRewards, 0) / recentBuckets.length;
    const annualRevenueBTC = (avgRewardSats * BLOCKS_PER_YEAR) / SATS_PER_BTC;

    const supplyBTC = calculateSupply(currentHeight);
    const securityBudget = (annualRevenueBTC / supplyBTC) * 100;

    const status = classifyStatus(securityBudget);
    const styles = STATUS_STYLES[status];

    // === Update value display ===
    valueEl.textContent = securityBudget.toFixed(2) + '%';
    valueEl.className   = `text-3xl font-bold ${styles.valueClass} mono`;

    // === Update badge ===
    if (badgeEl) {
      badgeEl.textContent   = status;
      badgeEl.className     = styles.badge;
      badgeEl.title         = `Annualized miner revenue: ${annualRevenueBTC.toFixed(0)} BTC over ${supplyBTC.toFixed(0)} BTC supply`;
      badgeEl.style.opacity = '1';
    }

    // === Update attack cost (1-hour foregone honest revenue, USD) ===
    // 6 blocks/hour × avg reward in BTC × price = hourly honest miner revenue.
    // This is a lower-bound proxy for attack cost (Budish/Bonneau approach).
    if (attackCostEl) {
      const avgRewardBTC = avgRewardSats / SATS_PER_BTC;
      const hourlyAttackCostUSD = 6 * avgRewardBTC * priceUSD;
      attackCostEl.textContent = formatUSD(hourlyAttackCostUSD);
    }

    // === Sparkline: security budget % over time ===
    const rawPoints = rewardsData.map(bucket => {
      const annualRevBTC = (bucket.avgRewards * BLOCKS_PER_YEAR) / SATS_PER_BTC;
      const supplyAtHeight = calculateSupply(bucket.avgHeight);
      return supplyAtHeight > 0 ? (annualRevBTC / supplyAtHeight) * 100 : 0;
    });

    const points = rollingAverage(rawPoints, SMOOTHING_WINDOW);

    renderSparkline({
      lineId: 'security-budget-spark-line',
      areaId: 'security-budget-spark-area',
      points,
      color:  styles.sparkColor,
    });

    console.log(
      `✅ Security Budget: ${securityBudget.toFixed(2)}% (${status}) ` +
      `— ${annualRevenueBTC.toFixed(0)} BTC/yr / ${supplyBTC.toFixed(0)} BTC supply`
    );

  } catch (err) {
    console.error('⚠️ Security Budget update failed:', err);
    if (badgeEl) {
      badgeEl.title         = 'Live data unavailable';
      badgeEl.style.opacity = '0.6';
    }
    throw err;
  }
}
