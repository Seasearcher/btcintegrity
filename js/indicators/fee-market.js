// Indicator 1: Fee Market Maturity
// Source: mempool.space (free, open, no API key)
// Measures: transaction fees as a share of total block reward (in BTC)
//
// Why this matters:
// As the block subsidy halves every ~4 years, Bitcoin's security budget must
// increasingly come from transaction fees. A healthy, mature fee market is
// essential for long-term network security post-2140 (when subsidy = 0).
//
// Current era (2024-2028, post-4th halving): subsidy = 3.125 BTC/block.
// Fee shares typically run 0.3%-2% in normal conditions, with spikes during
// congestion (ordinals, runes, mempool backlogs) reaching 5-10%+.

import { renderSparkline } from '../utils/sparkline.js';

const ENDPOINTS = {
  fees:    'https://mempool.space/api/v1/mining/blocks/fees/3m',
  rewards: 'https://mempool.space/api/v1/mining/blocks/rewards/3m',
};

// Thresholds calibrated for the current halving era (3.125 BTC subsidy).
// Re-tune after each halving as fee share naturally doubles relative to subsidy.
const THRESHOLDS = {
  healthy: 2,    // >= 2%   = strong fee demand, market maturing
  concern: 0.5,  // 0.5-2%  = normal baseline
  // < 0.5%        = critical, near subsidy-only economy
};

// Smoothing window for the sparkline (in buckets).
// Higher = smoother trend, lower = more responsive to spikes.
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

function classifyStatus(feeShare) {
  if (feeShare >= THRESHOLDS.healthy) return 'Healthy';
  if (feeShare >= THRESHOLDS.concern) return 'Concern';
  return 'Critical';
}

// Apply a trailing rolling average to smooth out per-bucket noise.
// Each output point is the average of the last `window` raw points (or fewer
// at the start of the series).
function rollingAverage(values, window) {
  return values.map((_, i, arr) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

export async function updateFeeMarket() {
  const valueEl = document.getElementById('fee-market-value');
  const badgeEl = document.getElementById('fee-market-badge');

  if (!valueEl) {
    throw new Error('fee-market-value element not found');
  }

  try {
    const [feesRes, rewardsRes] = await Promise.all([
      fetch(ENDPOINTS.fees),
      fetch(ENDPOINTS.rewards),
    ]);

    if (!feesRes.ok || !rewardsRes.ok) {
      throw new Error('mempool.space API returned non-OK status');
    }

    const feesData    = await feesRes.json();
    const rewardsData = await rewardsRes.json();

    if (!feesData.length || !rewardsData.length) {
      throw new Error('mempool.space API returned empty data');
    }

    // Build a height-indexed map for safe matching, in case the two endpoints
    // ever return different bucket counts or skipped buckets.
    const rewardMap = new Map(
      rewardsData.map(r => [r.avgHeight, r.avgRewards])
    );

    // Sum across all buckets (values are in satoshis).
    // We only sum buckets where we have both fee AND reward data.
    let totalFees    = 0;
    let totalRewards = 0;

    for (const bucket of feesData) {
      const reward = rewardMap.get(bucket.avgHeight);
      if (reward && reward > 0) {
        totalFees    += bucket.avgFees || 0;
        totalRewards += reward;
      }
    }

    if (totalRewards === 0) {
      throw new Error('No reward data available');
    }

    const feeShare = (totalFees / totalRewards) * 100;
    const status   = classifyStatus(feeShare);
    const styles   = STATUS_STYLES[status];

    // Update value display
    valueEl.textContent = feeShare.toFixed(2) + '%';
    valueEl.className   = `text-3xl font-bold ${styles.valueClass} mono`;

    // Update status badge
    if (badgeEl) {
      badgeEl.textContent   = status;
      badgeEl.className     = styles.badge;
      badgeEl.title         = `Fee share over last 3 months: ${feeShare.toFixed(2)}%`;
      badgeEl.style.opacity = '1';
    }

    // Build per-bucket fee shares for the sparkline trend.
    const rawPoints = feesData.map(bucket => {
      const reward = rewardMap.get(bucket.avgHeight) || 0;
      const fees   = bucket.avgFees || 0;
      return reward > 0 ? (fees / reward) * 100 : 0;
    });

    // Smooth out single-block spikes so the sparkline shows the trend,
    // not the noise. A 7-bucket trailing average filters out individual
    // high-fee blocks while still revealing multi-day shifts.
    const points = rollingAverage(rawPoints, SMOOTHING_WINDOW);

    renderSparkline({
      lineId: 'fee-market-spark-line',
      areaId: 'fee-market-spark-area',
      points,
      color:  styles.sparkColor,
    });

    console.log(
      `✅ Fee Market: ${feeShare.toFixed(2)}% (${status}) ` +
      `— ${feesData.length} buckets, smoothed window=${SMOOTHING_WINDOW}`
    );

  } catch (err) {
    console.error('⚠️ Fee Market update failed:', err);
    if (badgeEl) {
      badgeEl.title         = 'Live data unavailable';
      badgeEl.style.opacity = '0.6';
    }
    throw err; // re-throw so main.js can log it
  }
}
