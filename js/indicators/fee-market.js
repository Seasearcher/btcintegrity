// Indicator 1: Fee Market Maturity
// Source: mempool.space (free, open, no API key)
// Measures: transaction fees as a share of total block reward (in BTC)

import { renderSparkline } from '../utils/sparkline.js';

const ENDPOINTS = {
  fees:    'https://mempool.space/api/v1/mining/blocks/fees/3m',
  rewards: 'https://mempool.space/api/v1/mining/blocks/rewards/3m',
};

// Thresholds for status classification (in % fee share)
const THRESHOLDS = {
  healthy:  15, // >= 15%
  concern:  5,  // 5-15%
  // < 5% = critical
};

const STATUS_STYLES = {
  Healthy: {
    badge: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueClass: 'text-emerald-400',
    sparkColor: '#34d399',
  },
  Concern: {
    badge: 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20',
    valueClass: 'text-rose-400',
    sparkColor: '#fb7185',
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

    // Sum across all buckets (values are in satoshis)
    const totalFees    = feesData.reduce((s, b) => s + (b.avgFees    || 0), 0);
    const totalRewards = rewardsData.reduce((s, b) => s + (b.avgRewards || 0), 0);

    if (totalRewards === 0) throw new Error('No reward data available');

    const feeShare = (totalFees / totalRewards) * 100;
    const status   = classifyStatus(feeShare);
    const styles   = STATUS_STYLES[status];

    // Update value
    valueEl.textContent = feeShare.toFixed(1) + '%';
    valueEl.className   = `text-3xl font-bold ${styles.valueClass} mono`;

    // Update badge
    if (badgeEl) {
      badgeEl.textContent = status;
      badgeEl.className   = styles.badge;
    }

    // Build sparkline from per-bucket fee shares
    const points = feesData
      .map((b, i) => {
        const reward = rewardsData[i]?.avgRewards || 0;
        const fees   = b.avgFees || 0;
        return reward > 0 ? (fees / reward) * 100 : null;
      })
      .filter(v => v !== null);

    renderSparkline({
      lineId: 'fee-market-spark-line',
      areaId: 'fee-market-spark-area',
      points,
      color:  styles.sparkColor,
    });

    console.log(`✅ Fee Market: ${feeShare.toFixed(2)}% (${status})`);

  } catch (err) {
    console.error('⚠️ Fee Market update failed:', err);
    if (badgeEl) {
      badgeEl.title         = 'Live data unavailable';
      badgeEl.style.opacity = '0.6';
    }
    throw err; // re-throw so main.js can log it
  }
}
